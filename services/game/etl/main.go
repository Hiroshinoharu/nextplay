package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/maxceban/nextplay/services/game/db"
	"github.com/maxceban/nextplay/services/game/etl/igdb"
	"github.com/maxceban/nextplay/services/shared/config"
)

// main is the entry point for the ETL process
func main() {
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
		log.Fatal("Failed to load config: ", err)
	}

	clientID := strings.TrimSpace(os.Getenv("IGDB_CLIENT_ID"))
	accessToken := strings.TrimSpace(os.Getenv("IGDB_ACCESS_TOKEN"))
	if clientID == "" || accessToken == "" {
		log.Fatal("IGDB_CLIENT_ID and IGDB_ACCESS_TOKEN must be set")
	}

	// Connect to the database
	dbURL := strings.TrimSpace(cfg.DatabaseURL)
	if local := strings.TrimSpace(cfg.LocalDatabaseURL); local != "" {
		dbURL = local
	}
	if err := db.Connect(dbURL); err != nil {
		log.Fatal("Failed to connect to DB: ", err)
	}

	maxGames := 300
	if raw := strings.TrimSpace(os.Getenv("IGDB_MAX_GAMES")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			maxGames = parsed
		}
	}
	log.Printf("Extracting %d games from IGDB", maxGames)

	client := igdb.Client{
		ClientID:    clientID,
		AccessToken: accessToken,
		HTTPClient:  &http.Client{Timeout: 30 * time.Second},
	}

	games, err := client.FetchGames(maxGames)
	if err != nil {
		log.Fatal("Failed to fetch games: ", err)
	}

	genreIDs := collectIDs(games, func(game igdb.Game) []int { return game.Genres })
	platformIDs := collectIDs(games, func(game igdb.Game) []int { return game.Platforms })
	keywordIDs := collectIDs(games, func(game igdb.Game) []int { return game.Keywords })
	coverIDs := collectIDs(games, func(game igdb.Game) []int {
		if game.CoverID > 0 {
			return []int{game.CoverID}
		}
		return nil
	})
	
	involvedCompanyIDs := collectIDs(games, func(game igdb.Game) []int { return game.InvolvedCompanies })
	artworkIDs := collectIDs(games, func(game igdb.Game) []int { return game.Artworks })
	screenshotIDs := collectIDs(games, func(game igdb.Game) []int { return game.Screenshots })
	videoIDs := collectIDs(games, func(game igdb.Game) []int { return game.Videos })

	genreNames, err := client.FetchNamed("/genres", genreIDs)
	if err != nil {
		log.Fatal("Failed to fetch genres: ", err)
	}
	platformNames, err := client.FetchNamed("/platforms", platformIDs)
	if err != nil {
		log.Fatal("Failed to fetch platforms: ", err)
	}
	keywordNames, err := client.FetchNamed("/keywords", keywordIDs)
	if err != nil {
		log.Fatal("Failed to fetch keywords: ", err)
	}
	involvedCompanies, err := client.FetchInvolvedCompanies(involvedCompanyIDs)
	if err != nil {
		log.Fatal("Failed to fetch involved companies: ", err)
	}
	coverImageIDs, err := client.FetchImageIDs("/covers", coverIDs)
	if err != nil {
		log.Fatal("Failed to fetch covers: ", err)
	}
	artworkImageIDs, err := client.FetchImageIDs("/artworks", artworkIDs)
	if err != nil {
		log.Fatal("Failed to fetch artworks: ", err)
	}
	screenshotImageIDs, err := client.FetchImageIDs("/screenshots", screenshotIDs)
	if err != nil {
		log.Fatal("Failed to fetch screenshots: ", err)
	}
	videoEntries, err := client.FetchGameVideos(videoIDs)
	if err != nil {
		log.Fatal("Failed to fetch videos: ", err)
	}
	companyNames, err := client.FetchNamed("/companies", collectCompanyIDs(involvedCompanies))
	if err != nil {
		log.Fatal("Failed to fetch companies: ", err)
	}

	platformDBIDs, err := upsertNamedRows("platform", "platform_name", platformNames)
	if err != nil {
		log.Fatal("Failed to upsert platforms: ", err)
	}
	keywordDBIDs, err := upsertNamedRows("keyword", "keyword_name", keywordNames)
	if err != nil {
		log.Fatal("Failed to upsert keywords: ", err)
	}
	genreDBIDs, err := upsertNamedRows("genre", "genre_name", genreNames)
	if err != nil {
		log.Fatal("Failed to upsert genres: ", err)
	}
	companyDBIDs, err := upsertNamedRows("company", "company_name", companyNames)
	if err != nil {
		log.Fatal("Failed to upsert companies: ", err)
	}
	publishersByGame := buildPublishersByGame(games, involvedCompanies, companyNames)
	coverURLByGame := buildCoverURLsByGame(games, coverImageIDs, artworkImageIDs, screenshotImageIDs)
	logMissingGameFields(games, publishersByGame, coverURLByGame, genreNames)

	gameRows := make([]gameUpsertRow, 0, len(games))
	gameRowIndex := make(map[int]int, len(games))
	duplicateRows := 0
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
		return existing
	}
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
		}

		if idx, exists := gameRowIndex[game.ID]; exists {
			gameRows[idx] = mergeRow(gameRows[idx], row)
			duplicateRows++
			continue
		}

		gameRowIndex[game.ID] = len(gameRows)
		gameRows = append(gameRows, row)
	}

	if duplicateRows > 0 {
		log.Printf("Deduplicated %d duplicate game rows by igdb_id", duplicateRows)
	}

	gameIDByIGDB, err := batchUpsertGames(gameRows)
	if err != nil {
		log.Fatal("Failed to bulk upsert games: ", err)
	}

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
			dbID, ok := companyDBIDs[entry.CompanyID]
			if !ok {
				continue
			}
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
	if err := bulkInsertJoinPairs("game_platform", "game_id", "platform_id", platformLeft, platformRight); err != nil {
		log.Printf("Failed to bulk link platforms: %v", err)
	}
	// Bulk insert joins and media
	if err := bulkInsertJoinPairs("game_keywords", "game_id", "keyword_id", keywordLeft, keywordRight); err != nil {
		log.Printf("Failed to bulk link keywords: %v", err)
	}
	// Bulk insert joins and media
	if err := bulkInsertJoinPairs("game_genre", "game_id", "genre_id", genreLeft, genreRight); err != nil {
		log.Printf("Failed to bulk link genres: %v", err)
	}
	// Bulk insert joins and media
	if err := bulkInsertGameCompaniesPairs(companyGameIDs, companyIDs, companyIsDeveloper, companyIsPublisher); err != nil {
		log.Printf("Failed to bulk link companies: %v", err)
	}
	if err := bulkInsertGameMedia(mediaGameIDs, mediaIgdbIDs, mediaTypes, mediaURLs, mediaSortOrders); err != nil {
		log.Printf("Failed to bulk insert media: %v", err)
	}
	log.Println("ETL process completed successfully")
}

// collectIDs extracts unique IDs from a slice of games using the provided getter function.
// It returns a slice of unique IDs.
func collectIDs(games []igdb.Game, getter func(igdb.Game) []int) []int {
	seen := make(map[int]struct{})
	for _, game := range games {
		for _, id := range getter(game) {
			if id <= 0 {
				continue
			}
			seen[id] = struct{}{}
		}
	}
	ids := make([]int, 0, len(seen))
	for id := range seen {
		ids = append(ids, id)
	}
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
