package main

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/joho/godotenv"
	"github.com/maxceban/nextplay/services/game/db"
	"github.com/maxceban/nextplay/services/game/etl/igdb"
	"github.com/maxceban/nextplay/services/shared/config"
)

// main is the entry point for the ETL process
func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

// run executes the ETL process: it loads configuration, connects to the database,
func run() error {
	envPath, err := findEnvFile("deploy/env/game.env")
	if err != nil {
		log.Println("No env file loaded:", err)
	} else if err := loadEnvFileNoOverwrite(envPath); err != nil {
		log.Println("No env file loaded:", err)
	}

	cfg, err := config.Load(config.Defaults{
		DatabaseURL:       "postgres://nextplay:nextplay@localhost:5432/nextplay?sslmode=disable",
		GatewayServiceURL: "http://localhost:8084",
	})
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	clientID := strings.TrimSpace(os.Getenv("IGDB_CLIENT_ID"))
	accessToken := strings.TrimSpace(os.Getenv("IGDB_ACCESS_TOKEN"))
	if clientID == "" || accessToken == "" {
		return errors.New("IGDB_CLIENT_ID and IGDB_ACCESS_TOKEN must be set")
	}

	// Connect to the database
	dbURL := strings.TrimSpace(cfg.DatabaseURL)
	if local := strings.TrimSpace(cfg.LocalDatabaseURL); local != "" {
		dbURL = local
	}
	if err := db.Connect(dbURL); err != nil {
		return fmt.Errorf("failed to connect to DB: %w", err)
	}

	maxGames := 300
	if raw := strings.TrimSpace(os.Getenv("IGDB_MAX_GAMES")); raw != "" {
		if strings.EqualFold(raw, "all") || raw == "0" {
			maxGames = 0
		} else {
			parsed, err := strconv.Atoi(raw)
			if err != nil || parsed < 0 {
				log.Printf("Invalid IGDB_MAX_GAMES=%q, using default %d", raw, maxGames)
			} else {
				maxGames = parsed
			}
		}
	}
	if maxGames == 0 {
		log.Printf("Extracting all games from IGDB")
	} else {
		log.Printf("Extracting %d games from IGDB", maxGames)
	}

	// Initialize IGDB client and fetch data with rate limiting and concurrency settings
	rps := 4
	if raw := strings.TrimSpace(os.Getenv("IGDB_RPS")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			log.Printf("Invalid IGDB_RPS=%q, using default %d", raw, rps)
		} else {
			rps = parsed
		}
	}
	// Default max concurrent is set to 2 to allow some concurrency while avoiding excessive parallelism that could lead to rate limit issues or resource exhaustion.
	// Adjust as needed based on testing and IGDB's tolerance.
	maxConcurrent := 2
	if raw := strings.TrimSpace(os.Getenv("IGDB_MAX_CONCURRENT")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			log.Printf("Invalid IGDB_MAX_CONCURRENT=%q, using default %d", raw, maxConcurrent)
		} else {
			maxConcurrent = parsed
		}
	}

	// Popularity settings - these control how we fetch games based on IGDB's popularity metrics, allowing for more targeted extraction of popular games if desired.
	popularityYear := 0
	if raw := strings.TrimSpace(os.Getenv("IGDB_POPULARITY_YEAR")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			log.Printf("Invalid IGDB_POPULARITY_YEAR=%q, ignoring", raw)
		} else {
			popularityYear = parsed
		}
	}

	// Popularity pool size controls how many top games to consider when using popularity-based seeding. If not set, it will be calculated based on the target number of games with reasonable bounds.
	popularityPool := 0
	if raw := strings.TrimSpace(os.Getenv("IGDB_POPULARITY_POOL")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			log.Printf("Invalid IGDB_POPULARITY_POOL=%q, ignoring", raw)
		} else {
			popularityPool = parsed
		}
	}
	// Popularity max games and max IDs provide additional limits when using popularity-based seeding, allowing for more control over how many games are ultimately fetched based on popularity criteria.
	popularityMaxGames := 0
	if raw := strings.TrimSpace(os.Getenv("IGDB_POPULARITY_MAX_GAMES")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			log.Printf("Invalid IGDB_POPULARITY_MAX_GAMES=%q, ignoring", raw)
		} else {
			popularityMaxGames = parsed
		}
	}
	// popularityMaxIDs and popularityMaxPages are used when fetching all games sorted by popularity, allowing for limits on how many games to consider and how many pages of results to fetch, which can help manage the scope of the extraction when using popularity as a criterion.
	popularityMaxIDs := 0
	if raw := strings.TrimSpace(os.Getenv("IGDB_POPULARITY_MAX_IDS")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			log.Printf("Invalid IGDB_POPULARITY_MAX_IDS=%q, ignoring", raw)
		} else {
			popularityMaxIDs = parsed
		}
	}
	// popularityMaxPages is an additional safeguard to prevent excessive paging when fetching games by popularity, which can be useful if the IGDB API has limits on how many results can be fetched or if there are concerns about long-running requests.
	popularityMaxPages := 0
	if raw := strings.TrimSpace(os.Getenv("IGDB_POPULARITY_MAX_PAGES")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			log.Printf("Invalid IGDB_POPULARITY_MAX_PAGES=%q, ignoring", raw)
		} else {
			popularityMaxPages = parsed
		}
	}
	// popularityType allows for selecting different types of popularity metrics from IGDB, which can provide flexibility in how games are ranked and selected based on popularity criteria.
	usePopularitySeed := strings.EqualFold(strings.TrimSpace(os.Getenv("IGDB_POPULARITY_SEED")), "true") ||
		strings.TrimSpace(os.Getenv("IGDB_POPULARITY_SEED")) == "1" ||
		popularityYear > 0
	usePopularityAll := strings.EqualFold(strings.TrimSpace(os.Getenv("IGDB_POPULARITY_ALL")), "true") ||
		strings.TrimSpace(os.Getenv("IGDB_POPULARITY_ALL")) == "1"
	popularityType := 1
	if raw := strings.TrimSpace(os.Getenv("IGDB_POPULARITY_TYPE")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			log.Printf("Invalid IGDB_POPULARITY_TYPE=%q, using default %d", raw, popularityType)
		} else {
			popularityType = parsed
		}
	}

	// Initialize IGDB client with rate limiting settings
	minInterval := time.Second / time.Duration(rps)
	log.Printf("IGDB rate limit: %d rps, max concurrent=%d", rps, maxConcurrent)
	log.Printf("IGDB popularity type: %d", popularityType)
	if usePopularitySeed {
		log.Printf("IGDB popularity seed enabled (year=%d)", popularityYear)
	}
	if usePopularityAll {
		log.Printf("IGDB popularity all enabled (max_ids=%d, max_pages=%d)", popularityMaxIDs, popularityMaxPages)
	}

	// Create IGDB client struct
	client := igdb.Client{
		ClientID:      clientID,
		AccessToken:   accessToken,
		HTTPClient:    &http.Client{Timeout: 30 * time.Second},
		MaxConcurrent: maxConcurrent,
		MinInterval:   minInterval,
	}

	// Fetch games
	var games []igdb.Game
	// popularityByGame will hold the popularity values for games when using popularity-based fetching, allowing us to include this data in the upsert rows later on. It is populated during the fetching process based on the selected popularity criteria.
	popularityByGame := map[int]float64{}
	if usePopularityAll {
		seedIDs, seedPopularity, err := client.FetchAllPopularityGameIDs(popularityType, popularityMaxIDs, popularityMaxPages)
		if err != nil {
			return fmt.Errorf("failed to fetch popularity seed: %w", err)
		}
		popularityByGame = seedPopularity
		if len(seedIDs) == 0 {
			return fmt.Errorf("no popularity seeds returned")
		}
		games, err = client.FetchGamesByIDs(seedIDs)
		if err != nil {
			return fmt.Errorf("failed to fetch games by popularity: %w", err)
		}
		if popularityYear > 0 {
			games = filterGamesByReleaseYear(games, popularityYear)
		}
		games = orderGamesByIDList(games, seedIDs)
		if popularityMaxGames > 0 && len(games) > popularityMaxGames {
			games = games[:popularityMaxGames]
		}
	} else if usePopularitySeed {
		targetGames := maxGames
		if popularityMaxGames > 0 {
			targetGames = popularityMaxGames
		}
		// Determine pool size: if not set, calculate based on targetGames with reasonable bounds to avoid excessively large pools
		pool := popularityPool
		if pool <= 0 {
			pool = targetGames * 5
			if pool < 500 {
				pool = 500
			}
			if pool > 5000 {
				pool = 5000
			}
		}
		// Fetch popularity seed IDs and their popularity values
		seedIDs, seedPopularity, err := client.FetchTopPopularityGameIDs(pool, popularityType)
		if err != nil {
			return fmt.Errorf("failed to fetch popularity seed: %w", err)
		}
		popularityByGame = seedPopularity
		if len(seedIDs) == 0 {
			return fmt.Errorf("no popularity seeds returned")
		}
		games, err = client.FetchGamesByIDs(seedIDs)
		if err != nil {
			return fmt.Errorf("failed to fetch games by popularity: %w", err)
		}
		if popularityYear > 0 {
			games = filterGamesByReleaseYear(games, popularityYear)
		}
		games = orderGamesByIDList(games, seedIDs)
		if targetGames > 0 && len(games) > targetGames {
			games = games[:targetGames]
		}
		if popularityYear > 0 {
			log.Printf("PopScore seed returned %d games for year %d (pool=%d, target=%d)", len(games), popularityYear, pool, targetGames)
		}
	} else {
		var err error
		games, err = client.FetchGames(maxGames)
		if err != nil {
			return fmt.Errorf("failed to fetch games: %w", err)
		}
	}

	// Gather auxiliary IDs
	genreIDs := collectIDs(games, func(game igdb.Game) []int { return game.Genres })
	platformIDs := collectIDs(games, func(game igdb.Game) []int { return game.Platforms })
	keywordIDs := collectIDs(games, func(game igdb.Game) []int { return game.Keywords })
	franchiseIDs := collectIDs(games, func(game igdb.Game) []int { return game.Franchises })
	seriesIDs := collectIDs(games, func(game igdb.Game) []int { return game.Collections })
	// Collect cover IDs
	coverIDs := collectIDs(games, func(game igdb.Game) []int {
		if game.CoverID > 0 {
			return []int{game.CoverID}
		}
		return nil
	})

	// Collect involved company IDs
	involvedCompanyIDs := collectIDs(games, func(game igdb.Game) []int { return game.InvolvedCompanies })
	artworkIDs := collectIDs(games, func(game igdb.Game) []int { return game.Artworks })
	screenshotIDs := collectIDs(games, func(game igdb.Game) []int { return game.Screenshots })
	videoIDs := collectIDs(games, func(game igdb.Game) []int { return game.Videos })
	gameIDs := collectIDs(games, func(game igdb.Game) []int {
		if game.ID > 0 {
			return []int{game.ID}
		}
		return nil
	})

	genreNames := map[int]string{}
	platformNames := map[int]string{}
	keywordNames := map[int]string{}
	franchiseNames := map[int]string{}
	seriesNames := map[int]string{}
	involvedCompanies := map[int]igdb.InvolvedCompany{}
	coverImageIDs := map[int]string{}
	artworkImageIDs := map[int]string{}
	screenshotImageIDs := map[int]string{}
	videoEntries := map[int]igdb.GameVideo{}

	// Fetch auxiliary data concurrently
	var fetchErr error
	// Mutex to protect fetchErr writes (Mutex is more efficient than RWMutex here since writes are rare)
	var fetchMu sync.Mutex
	// setFetchErr sets the fetchErr if it is not already set
	setFetchErr := func(context string, err error) {
		// Early exit if no error
		if err == nil {
			return
		}
		// Protect concurrent access to fetchErr
		fetchMu.Lock()
		if fetchErr == nil {
			fetchErr = fmt.Errorf("%s: %w", context, err)
		}
		fetchMu.Unlock()
	}

	// Use WaitGroup to wait for all fetches to complete
	var wg sync.WaitGroup
	// fetch starts a goroutine to execute the provided function and track its completion
	fetch := func(name string, fn func() error) {
		wg.Add(1)
		// The goroutine executes the fetch function and captures any error
		go func() {
			defer wg.Done()
			if err := fn(); err != nil {
				setFetchErr(name, err)
			}
		}()
	}

	// Start fetching auxiliary data
	if len(genreIDs) > 0 {
		fetch("fetch genres", func() error {
			var err error
			genreNames, err = client.FetchNamed("/genres", genreIDs)
			return err
		})
	}
	// Start fetching auxiliary data
	if len(platformIDs) > 0 {
		fetch("fetch platforms", func() error {
			var err error
			platformNames, err = client.FetchNamed("/platforms", platformIDs)
			return err
		})
	}
	// Start fetching auxiliary data
	if len(keywordIDs) > 0 {
		fetch("fetch keywords", func() error {
			var err error
			keywordNames, err = client.FetchNamed("/keywords", keywordIDs)
			return err
		})
	}
	if len(franchiseIDs) > 0 {
		fetch("fetch franchises", func() error {
			var err error
			franchiseNames, err = client.FetchNamed("/franchises", franchiseIDs)
			return err
		})
	}
	if len(seriesIDs) > 0 {
		fetch("fetch series", func() error {
			var err error
			seriesNames, err = client.FetchNamed("/collections", seriesIDs)
			return err
		})
	}
	// Start fetching auxiliary data
	if len(involvedCompanyIDs) > 0 {
		fetch("fetch involved companies", func() error {
			var err error
			involvedCompanies, err = client.FetchInvolvedCompanies(involvedCompanyIDs)
			return err
		})
	}
	// Start fetching auxiliary data
	if len(coverIDs) > 0 {
		fetch("fetch covers", func() error {
			var err error
			coverImageIDs, err = client.FetchImageIDs("/covers", coverIDs)
			return err
		})
	}
	// Start fetching auxiliary data
	if len(artworkIDs) > 0 {
		fetch("fetch artworks", func() error {
			var err error
			artworkImageIDs, err = client.FetchImageIDs("/artworks", artworkIDs)
			return err
		})
	}
	// Start fetching auxiliary data
	if len(screenshotIDs) > 0 {
		fetch("fetch screenshots", func() error {
			var err error
			screenshotImageIDs, err = client.FetchImageIDs("/screenshots", screenshotIDs)
			return err
		})
	}
	// Start fetching auxiliary data
	if len(videoIDs) > 0 {
		fetch("fetch videos", func() error {
			var err error
			videoEntries, err = client.FetchGameVideos(videoIDs)
			return err
		})
	}
	if len(gameIDs) > 0 {
		missingPopularityIDs := make([]int, 0, len(gameIDs))
		for _, id := range gameIDs {
			if _, ok := popularityByGame[id]; !ok {
				missingPopularityIDs = append(missingPopularityIDs, id)
			}
		}
		if len(missingPopularityIDs) > 0 {
			fetch("fetch popularity", func() error {
				values, err := client.FetchPopularityPrimitives(missingPopularityIDs, popularityType)
				if err != nil {
					return err
				}
				for id, value := range values {
					popularityByGame[id] = value
				}
				return nil
			})
		}
	}

	// Wait for all fetches to complete
	wg.Wait()
	// Check if any fetch resulted in an error
	if fetchErr != nil {
		return fetchErr
	}
	if len(genreIDs) > 0 {
		missingGenreIDs := unresolvedIDs(genreIDs, genreNames)
		log.Printf(
			"Genre lookup coverage: requested=%d, resolved=%d, missing=%d",
			len(genreIDs),
			len(genreNames),
			len(missingGenreIDs),
		)
		log.Printf("Sample unresolved genre IDs: %s", sampleIDs(missingGenreIDs, 10))
	}

	// Begin database transaction
	companyNames, err := client.FetchNamed("/companies", collectCompanyIDs(involvedCompanies))
	if err != nil {
		return fmt.Errorf("failed to fetch companies: %w", err)
	}

	// Begin transaction
	tx, err := db.DB.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	// Ensure transaction rollback on error
	committed := false
	// defer rollback if not committed
	defer func() {
		if committed {
			return
		}
		_ = tx.Rollback()
	}()

	// Upsert auxiliary data
	platformDBIDs, err := upsertNamedRows(tx, "platform", "platform_name", platformNames)
	if err != nil {
		return fmt.Errorf("failed to upsert platforms: %w", err)
	}
	keywordDBIDs, err := upsertNamedRows(tx, "keyword", "keyword_name", keywordNames)
	if err != nil {
		return fmt.Errorf("failed to upsert keywords: %w", err)
	}
	franchiseDBIDs, err := upsertNamedRows(tx, "franchise", "franchise_name", franchiseNames)
	if err != nil {
		return fmt.Errorf("failed to upsert franchises: %w", err)
	}
	seriesDBIDs, err := upsertNamedRows(tx, "series", "series_name", seriesNames)
	if err != nil {
		return fmt.Errorf("failed to upsert series: %w", err)
	}
	genreDBIDs, err := upsertNamedRows(tx, "genre", "genre_name", genreNames)
	if err != nil {
		return fmt.Errorf("failed to upsert genres: %w", err)
	}
	companyDBIDs, err := upsertNamedRows(tx, "company", "company_name", companyNames)
	if err != nil {
		return fmt.Errorf("failed to upsert companies: %w", err)
	}

	// Build auxiliary data
	publishersByGame := buildPublishersByGame(games, involvedCompanies, companyNames)
	coverURLByGame := buildCoverURLsByGame(games, coverImageIDs, artworkImageIDs, screenshotImageIDs)
	logMissingGameFields(games, publishersByGame, coverURLByGame, genreNames)

	// Prepare game upsert rows
	gameRows := make([]gameUpsertRow, 0, len(games))
	gameRowIndex := make(map[int]int, len(games))
	duplicateRows := 0

	// mergeRow merges two gameUpsertRow entries, preferring non-empty fields from the incoming row.
	mergeRow := func(existing, incoming gameUpsertRow) gameUpsertRow {
		if existing.Name == "" && incoming.Name != "" {
			existing.Name = incoming.Name
		}
		if existing.Description == nil && incoming.Description != nil {
			existing.Description = incoming.Description
		}
		if existing.ReleaseDate == nil && incoming.ReleaseDate != nil {
			existing.ReleaseDate = incoming.ReleaseDate
		}
		if existing.Genre == nil && incoming.Genre != nil {
			existing.Genre = incoming.Genre
		}
		if existing.Publishers == nil && incoming.Publishers != nil {
			existing.Publishers = incoming.Publishers
		}
		if existing.Story == nil && incoming.Story != nil {
			existing.Story = incoming.Story
		}
		if existing.CoverImageURL == nil && incoming.CoverImageURL != nil {
			existing.CoverImageURL = incoming.CoverImageURL
		}
		if existing.AggregatedRating == nil && incoming.AggregatedRating != nil {
			existing.AggregatedRating = incoming.AggregatedRating
		}
		if existing.AggregatedRatingCount == nil && incoming.AggregatedRatingCount != nil {
			existing.AggregatedRatingCount = incoming.AggregatedRatingCount
		}
		if existing.TotalRating == nil && incoming.TotalRating != nil {
			existing.TotalRating = incoming.TotalRating
		}
		if existing.TotalRatingCount == nil && incoming.TotalRatingCount != nil {
			existing.TotalRatingCount = incoming.TotalRatingCount
		}
		if existing.Popularity == nil && incoming.Popularity != nil {
			existing.Popularity = incoming.Popularity
		}
		return existing
	}
	// Build upsert rows, deduplicating by IGDB ID
	for _, game := range games {
		gameName := strings.TrimSpace(sanitizeText(game.Name))
		if game.ID <= 0 || gameName == "" {
			continue
		}
		var releaseDate *string
		if game.FirstReleaseDate > 0 {
			parsed := time.Unix(game.FirstReleaseDate, 0).UTC().Format("2006-01-02")
			releaseDate = &parsed
		}
		aggregatedRatingValue := game.AggregatedRating
		aggregatedRatingCountValue := game.AggregatedRatingCount
		if aggregatedRatingValue <= 0 && game.TotalRating > 0 {
			aggregatedRatingValue = game.TotalRating
			if aggregatedRatingCountValue <= 0 && game.TotalRatingCount > 0 {
				aggregatedRatingCountValue = game.TotalRatingCount
			}
		}
		// If there are multiple entries for the same IGDB ID, we merge them by preferring non-empty fields. This can happen if the IGDB data has duplicates or if we fetch the same game multiple times due to different seeding strategies. The mergeRow function handles this logic, and we keep track of duplicates for logging purposes.
		row := gameUpsertRow{
			IGDBID:        game.ID,
			Name:          gameName,
			Description:   nullableString(game.Summary),
			ReleaseDate:   releaseDate,
			Genre:         nullableString(joinNames(game.Genres, genreNames)),
			Publishers:    nullableString(publishersByGame[game.ID]),
			Story:         nullableString(game.Storyline),
			CoverImageURL: nullableString(coverURLByGame[game.ID]),
			AggregatedRating: func() *float64 {
				if aggregatedRatingValue <= 0 {
					return nil
				}
				value := aggregatedRatingValue
				return &value
			}(),
			AggregatedRatingCount: func() *int {
				if aggregatedRatingCountValue <= 0 {
					return nil
				}
				value := aggregatedRatingCountValue
				return &value
			}(),
			TotalRating: func() *float64 {
				if game.TotalRating <= 0 {
					return nil
				}
				value := game.TotalRating
				return &value
			}(),
			TotalRatingCount: func() *int {
				if game.TotalRatingCount <= 0 {
					return nil
				}
				value := game.TotalRatingCount
				return &value
			}(),
			Popularity: func() *float64 {
				value, ok := popularityByGame[game.ID]
				if !ok || value <= 0 {
					return nil
				}
				return &value
			}(),
		}

		if idx, exists := gameRowIndex[game.ID]; exists {
			gameRows[idx] = mergeRow(gameRows[idx], row)
			duplicateRows++
			continue
		}

		gameRowIndex[game.ID] = len(gameRows)
		gameRows = append(gameRows, row)
	}

	// Log deduplication info
	if duplicateRows > 0 {
		log.Printf("Deduplicated %d duplicate game rows by igdb_id", duplicateRows)
	}

	// Bulk upsert games
	gameIDByIGDB, err := batchUpsertGames(tx, gameRows)
	if err != nil {
		return fmt.Errorf("failed to bulk upsert games: %w", err)
	}

	// Prepare join and media insertions
	platformLeft := make([]int, 0, len(games)*4)
	platformRight := make([]int, 0, len(games)*4)
	keywordLeft := make([]int, 0, len(games)*6)
	keywordRight := make([]int, 0, len(games)*6)
	genreLeft := make([]int, 0, len(games)*4)
	genreRight := make([]int, 0, len(games)*4)
	franchiseLeft := make([]int, 0, len(games)*2)
	franchiseRight := make([]int, 0, len(games)*2)
	seriesLeft := make([]int, 0, len(games)*2)
	seriesRight := make([]int, 0, len(games)*2)
	platformIndex := make(map[[2]int]struct{}, len(games)*4)
	keywordIndex := make(map[[2]int]struct{}, len(games)*6)
	genreIndex := make(map[[2]int]struct{}, len(games)*4)
	franchiseIndex := make(map[[2]int]struct{}, len(games)*2)
	seriesIndex := make(map[[2]int]struct{}, len(games)*2)
	companyGameIDs := make([]int, 0, len(games)*4)
	companyIDs := make([]int, 0, len(games)*4)
	companyIsDeveloper := make([]bool, 0, len(games)*4)
	companyIsPublisher := make([]bool, 0, len(games)*4)
	companyIndex := make(map[[2]int]int, len(games)*4)
	mediaGameIDs := make([]int, 0, len(games)*6)
	mediaIgdbIDs := make([]int, 0, len(games)*6)
	mediaTypes := make([]string, 0, len(games)*6)
	mediaURLs := make([]string, 0, len(games)*6)
	mediaSortOrders := make([]int, 0, len(games)*6)
	mediaSeen := make(map[string]struct{}, len(games)*8)

	addMedia := func(gameID, igdbID, sortOrder int, mediaType, url string) {
		if gameID == 0 || igdbID <= 0 || url == "" {
			return
		}
		key := fmt.Sprintf("%d|%s|%d", gameID, mediaType, igdbID)
		if _, exists := mediaSeen[key]; exists {
			return
		}
		mediaSeen[key] = struct{}{}
		mediaGameIDs = append(mediaGameIDs, gameID)
		mediaIgdbIDs = append(mediaIgdbIDs, igdbID)
		mediaTypes = append(mediaTypes, mediaType)
		mediaURLs = append(mediaURLs, url)
		mediaSortOrders = append(mediaSortOrders, sortOrder)
	}

	for _, game := range games {
		// Find the DB game_id for this IGDB game
		gameID, ok := gameIDByIGDB[game.ID]
		if !ok {
			log.Printf("Skipping joins for game %q: missing game_id for igdb_id=%d", game.Name, game.ID)
			continue
		}

		// Link platforms
		for _, platformID := range game.Platforms {
			if dbID, ok := platformDBIDs[platformID]; ok {
				key := [2]int{gameID, dbID}
				if _, exists := platformIndex[key]; exists {
					continue
				}
				platformIndex[key] = struct{}{}
				platformLeft = append(platformLeft, gameID)
				platformRight = append(platformRight, dbID)
			}
		}

		// Link keywords
		for _, keywordID := range game.Keywords {
			if dbID, ok := keywordDBIDs[keywordID]; ok {
				key := [2]int{gameID, dbID}
				if _, exists := keywordIndex[key]; exists {
					continue
				}
				keywordIndex[key] = struct{}{}
				keywordLeft = append(keywordLeft, gameID)
				keywordRight = append(keywordRight, dbID)
			}
		}

		// Link genres
		for _, genreID := range game.Genres {
			if dbID, ok := genreDBIDs[genreID]; ok {
				key := [2]int{gameID, dbID}
				if _, exists := genreIndex[key]; exists {
					continue
				}
				genreIndex[key] = struct{}{}
				genreLeft = append(genreLeft, gameID)
				genreRight = append(genreRight, dbID)
			}
		}

		// Link franchise
		for _, franchiseID := range game.Franchises {
			if dbID, ok := franchiseDBIDs[franchiseID]; ok {
				key := [2]int{gameID, dbID}
				if _, exists := franchiseIndex[key]; exists {
					continue
				}
				franchiseIndex[key] = struct{}{}
				franchiseLeft = append(franchiseLeft, gameID)
				franchiseRight = append(franchiseRight, dbID)
			}
		}

		// Link series
		for _, seriesID := range game.Collections {
			if dbID, ok := seriesDBIDs[seriesID]; ok {
				key := [2]int{gameID, dbID}
				if _, exists := seriesIndex[key]; exists {
					continue
				}
				seriesIndex[key] = struct{}{}
				seriesLeft = append(seriesLeft, gameID)
				seriesRight = append(seriesRight, dbID)
			}
		}

		// Link companies (publisher/developer roles)
		for _, involvedID := range game.InvolvedCompanies {
			entry, ok := involvedCompanies[involvedID]
			if !ok || entry.CompanyID <= 0 {
				continue
			}
			// Find the DB company_id
			dbID, ok := companyDBIDs[entry.CompanyID]
			if !ok {
				continue
			}
			// Avoid duplicate entries
			key := [2]int{gameID, dbID}
			if idx, exists := companyIndex[key]; exists {
				if entry.Developer && !companyIsDeveloper[idx] {
					companyIsDeveloper[idx] = true
				}
				if entry.Publisher && !companyIsPublisher[idx] {
					companyIsPublisher[idx] = true
				}
				continue
			}
			// New entry
			companyIndex[key] = len(companyGameIDs)
			companyGameIDs = append(companyGameIDs, gameID)
			companyIDs = append(companyIDs, dbID)
			companyIsDeveloper = append(companyIsDeveloper, entry.Developer)
			companyIsPublisher = append(companyIsPublisher, entry.Publisher)
		}

		// Media: screenshots
		for idx, screenshotID := range game.Screenshots {
			if imageID := strings.TrimSpace(screenshotImageIDs[screenshotID]); imageID != "" {
				addMedia(gameID, screenshotID, idx+1, "screenshot", buildImageURL("t_screenshot_big", imageID))
			}
		}

		// Media: artworks
		for idx, artworkID := range game.Artworks {
			if imageID := strings.TrimSpace(artworkImageIDs[artworkID]); imageID != "" {
				addMedia(gameID, artworkID, idx+1, "artwork", buildImageURL("t_1080p", imageID))
			}
		}

		// Media: trailers
		for idx, videoID := range game.Videos {
			if entry, ok := videoEntries[videoID]; ok && strings.TrimSpace(entry.VideoID) != "" {
				addMedia(gameID, videoID, idx+1, "trailer", buildVideoURL(entry.VideoID))
			}
		}
	}

	// Bulk insert joins and media
	if err := bulkInsertJoinPairs(tx, "game_platform", "game_id", "platform_id", platformLeft, platformRight); err != nil {
		return fmt.Errorf("failed to bulk link platforms: %w", err)
	}
	if err := bulkInsertJoinPairs(tx, "game_keywords", "game_id", "keyword_id", keywordLeft, keywordRight); err != nil {
		return fmt.Errorf("failed to bulk link keywords: %w", err)
	}
	if err := bulkInsertJoinPairs(tx, "game_genre", "game_id", "genre_id", genreLeft, genreRight); err != nil {
		return fmt.Errorf("failed to bulk link genres: %w", err)
	}
	if err := bulkInsertJoinPairs(tx, "game_franchise", "game_id", "franchise_id", franchiseLeft, franchiseRight); err != nil {
		return fmt.Errorf("failed to bulk link franchises: %w", err)
	}
	if err := bulkInsertJoinPairs(tx, "game_series", "game_id", "series_id", seriesLeft, seriesRight); err != nil {
		return fmt.Errorf("failed to bulk link series: %w", err)
	}
	if err := bulkInsertGameCompaniesPairs(tx, companyGameIDs, companyIDs, companyIsDeveloper, companyIsPublisher); err != nil {
		return fmt.Errorf("failed to bulk link companies: %w", err)
	}
	if err := bulkInsertGameMedia(tx, mediaGameIDs, mediaIgdbIDs, mediaTypes, mediaURLs, mediaSortOrders); err != nil {
		return fmt.Errorf("failed to bulk insert media: %w", err)
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	// Mark as committed
	committed = true
	log.Println("ETL process completed successfully")

	if shouldSyncViaGateway() {
		gatewayURL := strings.TrimSpace(os.Getenv("GATEWAY_SERVICE_URL"))
		if gatewayURL == "" {
			gatewayURL = strings.TrimSpace(cfg.GatewayServiceURL)
		}
		serviceToken := strings.TrimSpace(os.Getenv("GATEWAY_SERVICE_TOKEN"))
		if serviceToken == "" {
			serviceToken = strings.TrimSpace(os.Getenv("SERVICE_TOKEN"))
		}
		if gatewayURL == "" || serviceToken == "" {
			return fmt.Errorf("gateway sync enabled but GATEWAY_SERVICE_URL/GATEWAY_SERVICE_TOKEN is missing")
		}
		client := newGatewaySyncClient(gatewayURL, serviceToken)
		limit := gatewayWriteLimit()
		if limit > 0 {
			log.Printf("Gateway sync enabled: syncing up to %d games via %s", limit, gatewayURL)
		} else {
			log.Printf("Gateway sync enabled: syncing all %d games via %s", len(gameRows), gatewayURL)
		}
		if err := syncGamesViaGateway(client, gameRows, gameIDByIGDB, limit); err != nil {
			return fmt.Errorf("gateway sync failed: %w", err)
		}
		log.Println("Gateway sync completed successfully")
	}

	return nil
}

// collectIDs extracts unique IDs from a slice of games using the provided getter function.
// It returns a slice of unique IDs.
func collectIDs(games []igdb.Game, getter func(igdb.Game) []int) []int {
	// Keeps track of intial ids
	seen := make(map[int]struct{})
	for _, game := range games {
		for _, id := range getter(game) {
			if id <= 0 {
				continue
			}
			seen[id] = struct{}{}
		}
	}

	// Convert the set of seen IDs to a slice
	ids := make([]int, 0, len(seen))
	for id := range seen {
		ids = append(ids, id)
	}

	// Return the collected unique IDs
	return ids
}

func collectCompanyIDs(involved map[int]igdb.InvolvedCompany) []int {
	seen := make(map[int]struct{})
	for _, item := range involved {
		if item.CompanyID <= 0 {
			continue
		}
		seen[item.CompanyID] = struct{}{}
	}
	ids := make([]int, 0, len(seen))
	for id := range seen {
		ids = append(ids, id)
	}
	return ids
}

func filterGamesByReleaseYear(games []igdb.Game, year int) []igdb.Game {
	if year <= 0 {
		return games
	}
	out := make([]igdb.Game, 0, len(games))
	for _, game := range games {
		if game.FirstReleaseDate <= 0 {
			continue
		}
		releaseYear := time.Unix(game.FirstReleaseDate, 0).UTC().Year()
		if releaseYear == year {
			out = append(out, game)
		}
	}
	return out
}

func orderGamesByIDList(games []igdb.Game, idOrder []int) []igdb.Game {
	if len(games) == 0 || len(idOrder) == 0 {
		return games
	}
	byID := make(map[int]igdb.Game, len(games))
	for _, game := range games {
		byID[game.ID] = game
	}
	ordered := make([]igdb.Game, 0, len(idOrder))
	for _, id := range idOrder {
		if game, ok := byID[id]; ok {
			ordered = append(ordered, game)
		}
	}
	return ordered
}

// buildPublishersByGame constructs a map of game IDs to publisher names
// based on involved companies data.
func buildPublishersByGame(games []igdb.Game, involved map[int]igdb.InvolvedCompany, companyNames map[int]string) map[int]string {
	out := make(map[int]string, len(games))
	for _, game := range games {
		if len(game.InvolvedCompanies) == 0 {
			continue
		}
		seenPublishers := make(map[int]struct{})
		seenDevelopers := make(map[int]struct{})
		publishers := make([]string, 0, len(game.InvolvedCompanies))
		developers := make([]string, 0, len(game.InvolvedCompanies))
		for _, involvedID := range game.InvolvedCompanies {
			entry, ok := involved[involvedID]
			if !ok || entry.CompanyID <= 0 {
				continue
			}
			name := strings.TrimSpace(sanitizeText(companyNames[entry.CompanyID]))
			if name == "" {
				continue
			}
			if entry.Publisher {
				if _, ok := seenPublishers[entry.CompanyID]; !ok {
					seenPublishers[entry.CompanyID] = struct{}{}
					publishers = append(publishers, name)
				}
			}
			if entry.Developer {
				if _, ok := seenDevelopers[entry.CompanyID]; !ok {
					seenDevelopers[entry.CompanyID] = struct{}{}
					developers = append(developers, name)
				}
			}
		}
		if len(publishers) > 0 {
			out[game.ID] = strings.Join(publishers, ",")
		} else if len(developers) > 0 {
			out[game.ID] = strings.Join(developers, ",")
		}
	}
	return out
}

// buildCoverURLsByGame constructs cover image URLs for games based on their cover image IDs.
func buildCoverURLsByGame(games []igdb.Game, coverImageIDs, artworkImageIDs, screenshotImageIDs map[int]string) map[int]string {
	// Map of game ID to cover image URL
	out := make(map[int]string, len(games))
	for _, game := range games {
		if game.CoverID > 0 {
			if imageID := strings.TrimSpace(coverImageIDs[game.CoverID]); imageID != "" {
				out[game.ID] = buildCoverURL(imageID)
				continue
			}
		}
		if imageID := firstImageID(game.Artworks, artworkImageIDs); imageID != "" {
			out[game.ID] = buildCoverURL(imageID)
			continue
		}
		if imageID := firstImageID(game.Screenshots, screenshotImageIDs); imageID != "" {
			out[game.ID] = buildCoverURL(imageID)
		}
	}
	return out
}

// buildCoverURL constructs the full URL for a cover image given its image ID.
func buildCoverURL(imageID string) string {
	return buildImageURL("t_cover_big", imageID)
}

func buildImageURL(size, imageID string) string {
	return "https://images.igdb.com/igdb/image/upload/" + size + "/" + imageID + ".jpg"
}

func buildVideoURL(videoID string) string {
	return "https://www.youtube.com/watch?v=" + videoID
}

// firstImageID returns the first non-empty image ID from the provided list of IDs.
func firstImageID(ids []int, imageIDs map[int]string) string {
	for _, id := range ids {
		if imageID := strings.TrimSpace(imageIDs[id]); imageID != "" {
			return imageID
		}
	}
	return ""
}

// logMissingGameFields logs games that are missing critical fields like publishers, cover images, or genre names.
func logMissingGameFields(games []igdb.Game, publishersByGame, coverURLByGame map[int]string, genreNames map[int]string) {
	const sampleMax = 5
	var missingPublishers []int
	var missingCovers []int
	var missingGenres []int
	for _, game := range games {
		if strings.TrimSpace(publishersByGame[game.ID]) == "" {
			missingPublishers = append(missingPublishers, game.ID)
		}
		if strings.TrimSpace(coverURLByGame[game.ID]) == "" {
			missingCovers = append(missingCovers, game.ID)
		}
		if !hasGenreNames(game.Genres, genreNames) {
			missingGenres = append(missingGenres, game.ID)
		}
	}
	log.Printf("ETL missing fields: publishers=%d, covers=%d, genres=%d", len(missingPublishers), len(missingCovers), len(missingGenres))
	log.Printf("Sample missing publishers game IDs: %s", sampleIDs(missingPublishers, sampleMax))
	log.Printf("Sample missing covers game IDs: %s", sampleIDs(missingCovers, sampleMax))
	log.Printf("Sample missing genres game IDs: %s", sampleIDs(missingGenres, sampleMax))
}

// sampleIDs returns a string representation of up to max IDs from the provided slice.
func sampleIDs(ids []int, max int) string {
	// Return a string representation of up to max IDs from the provided slice.
	if len(ids) == 0 {
		return "none"
	}
	if max <= 0 || len(ids) <= max {
		return strings.Trim(strings.Join(strings.Fields(fmt.Sprint(ids)), ","), "[]")
	}
	return strings.Trim(strings.Join(strings.Fields(fmt.Sprint(ids[:max])), ","), "[]") + ",..."
}

func hasGenreNames(ids []int, genreNames map[int]string) bool {
	if len(ids) == 0 || len(genreNames) == 0 {
		return false
	}
	for _, id := range ids {
		if name := strings.TrimSpace(sanitizeText(genreNames[id])); name != "" {
			return true
		}
	}
	return false
}

func unresolvedIDs(ids []int, names map[int]string) []int {
	if len(ids) == 0 {
		return nil
	}
	out := make([]int, 0, len(ids))
	for _, id := range ids {
		if name := strings.TrimSpace(sanitizeText(names[id])); name == "" {
			out = append(out, id)
		}
	}
	return out
}

// findEnvFile searches for a .env file starting from the current working directory
// and moving up the directory tree until it finds the file or reaches the root.
func findEnvFile(relativePath string) (string, error) {
	start, err := os.Getwd()
	if err != nil {
		return "", err
	}
	dir := start
	for {
		candidate := filepath.Join(dir, relativePath)
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "", fmt.Errorf("env file not found from %s: %s", start, relativePath)
}

// loadEnvFileNoOverwrite loads environment variables from a .env file
// without overwriting any variables that are already set in the environment.
func loadEnvFileNoOverwrite(path string) error {
	values, err := godotenv.Read(path)
	if err != nil {
		return err
	}
	for key, value := range values {
		if _, exists := os.LookupEnv(key); exists {
			continue
		}
		_ = os.Setenv(key, value)
	}
	return nil
}
