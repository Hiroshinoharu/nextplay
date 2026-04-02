package main

import (
	"log"
	"net/url"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/shared/config"
	"github.com/maxceban/nextplay/services/shared/observability"
	"github.com/maxceban/nextplay/services/user/db"
	"github.com/maxceban/nextplay/services/user/routes"
)

func main() {
	cfg, err := config.Load(config.Defaults{
		Port:             "8083",
		DatabaseURL:      "postgres://nextplay:cdeebfe06ac79cde9c9d3a3104a2096901281ecd6ba4f05a@localhost:5432/nextplay?sslmode=disable",
		LocalDatabaseURL: "",
	})
	if err != nil {
		log.Fatal("Failed to load config: ", err)
	}

	databaseURL := resolveUserDatabaseURL(cfg.DatabaseURL, cfg.LocalDatabaseURL)

	if err := db.Connect(databaseURL); err != nil {
		log.Fatal("Failed to connect to DB: ", err)
	}
	if err := db.EnsureUserSchema(); err != nil {
		log.Fatal("Failed to ensure user schema: ", err)
	}

	app := fiber.New(fiber.Config{
		Network: "tcp",
	})
	app.Use(observability.AccessLog("user"))

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"service": "user",
			"status":  "running",
		})
	})

	routes.SetUpRoutes(app)

	app.Listen(":" + cfg.Port)
}

func resolveUserDatabaseURL(databaseURL, localDatabaseURL string) string {
	trimmedDatabaseURL := strings.TrimSpace(databaseURL)
	trimmedLocalDatabaseURL := strings.TrimSpace(localDatabaseURL)
	if trimmedLocalDatabaseURL == "" {
		return trimmedDatabaseURL
	}
	if shouldPreferLocalDatabaseURL(trimmedDatabaseURL) {
		return trimmedLocalDatabaseURL
	}
	return trimmedDatabaseURL
}

func shouldPreferLocalDatabaseURL(databaseURL string) bool {
	trimmedDatabaseURL := strings.TrimSpace(databaseURL)
	if trimmedDatabaseURL == "" {
		return true
	}

	parsed, err := url.Parse(trimmedDatabaseURL)
	if err != nil {
		return false
	}

	hostname := strings.ToLower(strings.TrimSpace(parsed.Hostname()))
	switch hostname {
	case "postgres", "postgresql", "db":
		return true
	default:
		return false
	}
}
