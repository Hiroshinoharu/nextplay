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

	if err := db.Connect(cfg.DatabaseURL); err != nil {
		log.Fatal("Failed to connect to DB: ", err)
	}

	maxGames := 50
	if raw := strings.TrimSpace(os.Getenv("IGDB_MAX_GAMES")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			maxGames = parsed
		}
	}

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

	platformDBIDs, err := ensureNamedRows("platform", "platform_name", platformNames)
	if err != nil {
		log.Fatal("Failed to upsert platforms: ", err)
	}
	keywordDBIDs, err := ensureNamedRows("keyword", "keyword_name", keywordNames)
	if err != nil {
		log.Fatal("Failed to upsert keywords: ", err)
	}

	for _, game := range games {
		// Upsert the game row itself
		gameID, err := upsertGame(game, genreNames)
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
