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

func main() {
	envPath, err := findEnvFile("deploy/env/game.env")
	if err != nil {
		log.Println("No env file loaded:", err)
	} else if err := godotenv.Load(envPath); err != nil {
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
		gameID, err := upsertGame(game, genreNames)
		if err != nil {
			log.Printf("Skipping game %q: %v", game.Name, err)
			continue
		}

		for _, platformID := range game.Platforms {
			if dbID, ok := platformDBIDs[platformID]; ok {
				if err := ensureJoinRow("game_platform", "game_id", "platform_id", gameID, dbID); err != nil {
					log.Printf("Failed to link game %q to platform: %v", game.Name, err)
				}
			}
		}

		for _, keywordID := range game.Keywords {
			if dbID, ok := keywordDBIDs[keywordID]; ok {
				if err := ensureJoinRow("game_keywords", "game_id", "keyword_id", gameID, dbID); err != nil {
					log.Printf("Failed to link game %q to keyword: %v", game.Name, err)
				}
			}
		}
	}
}

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
