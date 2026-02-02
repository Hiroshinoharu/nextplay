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

const defaultMetacriticCategoryID = 14

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
		DatabaseURL: "postgres://nextplay:nextplay@localhost:5432/nextplay?sslmode=disable",
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
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			log.Printf("Invalid IGDB_MAX_GAMES=%q, using default %d", raw, maxGames)
		} else {
			maxGames = parsed
		}
	}
	log.Printf("Extracting %d games from IGDB", maxGames)

	rps := 4
	if raw := strings.TrimSpace(os.Getenv("IGDB_RPS")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			log.Printf("Invalid IGDB_RPS=%q, using default %d", raw, rps)
		} else {
			rps = parsed
		}
	}
	maxConcurrent := 2
	if raw := strings.TrimSpace(os.Getenv("IGDB_MAX_CONCURRENT")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			log.Printf("Invalid IGDB_MAX_CONCURRENT=%q, using default %d", raw, maxConcurrent)
		} else {
			maxConcurrent = parsed
		}
	}

	metacriticCategoryID := defaultMetacriticCategoryID
	if raw := strings.TrimSpace(os.Getenv("IGDB_METACRITIC_CATEGORY_ID")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			log.Printf("Invalid IGDB_METACRITIC_CATEGORY_ID=%q, using default %d", raw, metacriticCategoryID)
		} else {
			metacriticCategoryID = parsed
		}
	}

	// Initialize IGDB client with rate limiting settings
	minInterval := time.Second / time.Duration(rps)
	log.Printf("IGDB rate limit: %d rps, max concurrent=%d", rps, maxConcurrent)
	log.Printf("IGDB metacritic category ID: %d", metacriticCategoryID)

	// Create IGDB client struct
	client := igdb.Client{
		ClientID:      clientID,
		AccessToken:   accessToken,
		HTTPClient:    &http.Client{Timeout: 30 * time.Second},
		MaxConcurrent: maxConcurrent,
		MinInterval:   minInterval,
	}

	// Fetch games
	games, err := client.FetchGames(maxGames)
	if err != nil {
		return fmt.Errorf("failed to fetch games: %w", err)
	}

	// Gather auxiliary IDs
	genreIDs := collectIDs(games, func(game igdb.Game) []int { return game.Genres })
	platformIDs := collectIDs(games, func(game igdb.Game) []int { return game.Platforms })
	keywordIDs := collectIDs(games, func(game igdb.Game) []int { return game.Keywords })
	externalGameIDs := collectIDs(games, func(game igdb.Game) []int { return game.ExternalGames })

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

	genreNames := map[int]string{}
	platformNames := map[int]string{}
	keywordNames := map[int]string{}
	involvedCompanies := map[int]igdb.InvolvedCompany{}
	externalGames := map[int]igdb.ExternalGame{}
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
	// Start fetching auxiliary data
	if len(involvedCompanyIDs) > 0 {
		fetch("fetch involved companies", func() error {
			var err error
			involvedCompanies, err = client.FetchInvolvedCompanies(involvedCompanyIDs)
			return err
		})
	}
	if len(externalGameIDs) > 0 {
		fetch("fetch external games", func() error {
			var err error
			externalGames, err = client.FetchExternalGames(externalGameIDs)
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

	// Wait for all fetches to complete
	wg.Wait()
	// Check if any fetch resulted in an error
	if fetchErr != nil {
		return fetchErr
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
	metacriticGames := buildMetacriticGamesByID(externalGames, metacriticCategoryID)
	if len(metacriticGames) > 0 {
		log.Printf("Found %d games with Metacritic links", len(metacriticGames))
	}

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
				if _, ok := metacriticGames[game.ID]; ok {
					return nil
				}
				if game.AggregatedRating <= 0 {
					return nil
				}
				value := game.AggregatedRating
				return &value
			}(),
			AggregatedRatingCount: func() *int {
				if _, ok := metacriticGames[game.ID]; ok {
					return nil
				}
				if game.AggregatedRatingCount <= 0 {
					return nil
				}
				value := game.AggregatedRatingCount
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
	platformIndex := make(map[[2]int]struct{}, len(games)*4)
	keywordIndex := make(map[[2]int]struct{}, len(games)*6)
	genreIndex := make(map[[2]int]struct{}, len(games)*4)
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

// buildMetacriticGamesByID builds a set of game IDs that have Metacritic entries
// based on the external games data and the specified Metacritic category ID.
func buildMetacriticGamesByID(externalGames map[int]igdb.ExternalGame, metacriticCategoryID int) map[int]struct{} {
	out := make(map[int]struct{})
	if metacriticCategoryID <= 0 || len(externalGames) == 0 {
		return out
	}
	for _, entry := range externalGames {
		if entry.GameID <= 0 {
			continue
		}
		if entry.Category != metacriticCategoryID {
			continue
		}
		out[entry.GameID] = struct{}{}
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
