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
	companyNames, err := client.FetchNamed("/companies", collectCompanyIDs(involvedCompanies))
	if err != nil {
		log.Fatal("Failed to fetch companies: ", err)
	}

	platformDBIDs, err := ensureNamedRows("platform", "platform_name", platformNames)
	if err != nil {
		log.Fatal("Failed to upsert platforms: ", err)
	}
	keywordDBIDs, err := ensureNamedRows("keyword", "keyword_name", keywordNames)
	if err != nil {
		log.Fatal("Failed to upsert keywords: ", err)
	}
	publishersByGame := buildPublishersByGame(games, involvedCompanies, companyNames)
	coverURLByGame := buildCoverURLsByGame(games, coverImageIDs, artworkImageIDs, screenshotImageIDs)
	logMissingGameFields(games, publishersByGame, coverURLByGame, genreNames)

	for _, game := range games {
		// Upsert the game row itself
		gameID, err := upsertGame(game, genreNames, publishersByGame, coverURLByGame)
		if err != nil {
			log.Printf("Skipping game %q: %v", game.Name, err)
			continue
		}
		if ok, err := gameExists(gameID); err != nil {
			log.Printf("Skipping game %q: failed to verify game id %d: %v", game.Name, gameID, err)
			continue
		} else if !ok {
			log.Printf("Skipping game %q: missing game row for id %d", game.Name, gameID)
			continue
		}

		// Link platforms
		for _, platformID := range game.Platforms {
			if dbID, ok := platformDBIDs[platformID]; ok {
				if err := ensureJoinRow("game_platform", "game_id", "platform_id", gameID, dbID); err != nil {
					exists, errCheck := gameExists(gameID)
					if errCheck != nil {
						log.Printf("Failed to link game %q to platform (game_id=%d, exists=unknown): %v", game.Name, gameID, err)
					} else {
						log.Printf("Failed to link game %q to platform (game_id=%d, exists=%t): %v", game.Name, gameID, exists, err)
					}
				}
			}
		}

		// Link keywords
		for _, keywordID := range game.Keywords {
			if dbID, ok := keywordDBIDs[keywordID]; ok {
				if err := ensureJoinRow("game_keywords", "game_id", "keyword_id", gameID, dbID); err != nil {
					exists, errCheck := gameExists(gameID)
					if errCheck != nil {
						log.Printf("Failed to link game %q to keyword (game_id=%d, exists=unknown): %v", game.Name, gameID, err)
					} else {
						log.Printf("Failed to link game %q to keyword (game_id=%d, exists=%t): %v", game.Name, gameID, exists, err)
					}
				}
			}
		}
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
	return "https://images.igdb.com/igdb/image/upload/t_cover_big/" + imageID + ".jpg"
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
