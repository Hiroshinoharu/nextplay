package main

import (
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/maxceban/nextplay/services/game/db"
	"github.com/maxceban/nextplay/services/game/routes"
	"github.com/maxceban/nextplay/services/shared/config"
	"github.com/maxceban/nextplay/services/shared/observability"
)

func main() {
	cfg, err := config.Load(config.Defaults{
		Port:                  "8081",
		DatabaseURL:           "postgres://nextplay:nextplay@localhost:5432/nextplay?sslmode=disable",
		FrontendURL:           "http://localhost:3000",
		UserServiceURL:        "http://localhost:8082",
		GatewayServiceURL:     "http://localhost:8080",
		RecommenderServiceURL: "http://localhost:8083",
		GameServiceURL:        "http://localhost:8081",
	})
	if err != nil {
		log.Fatal("Failed to load config: ", err)
	}

	// attempts to connect to database
	if err := db.Connect(cfg.DatabaseURL); err != nil {
		log.Fatal("Failed to connect to DB: ", err)
	}
	go func() {
		if _, err := db.GetQuestionnaireFacets(); err != nil {
			log.Printf("Questionnaire facets warmup failed: %v", err)
		}
	}()

	app := fiber.New()
	app.Use(observability.AccessLog("game"))

	app.Use(cors.New(cors.Config{
		AllowOrigins: resolveAllowedOrigins(cfg.FrontendURL),
		AllowHeaders: "Content-Type, Authorization",
	}))

	_, currentFile, _, _ := runtime.Caller(0)
	gameHTMLPath := filepath.Join(filepath.Dir(currentFile), "..", "..", "frontend", "game.html")
	serveGameHTML := func(c *fiber.Ctx) error {
		data, err := os.ReadFile(gameHTMLPath)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).SendString("Failed to load game.html")
		}
		c.Type("html", "utf-8")
		return c.Send(data)
	}

	app.Get("/", serveGameHTML)
	app.Get("/game", serveGameHTML)
	app.Get("/game/", serveGameHTML)
	app.Get("/game.html", serveGameHTML)

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"service": "game",
			"status":  "runnning",
		})
	})

	// Setup routes
	routes.SetUpRoutes(app)

	app.Listen(":" + cfg.Port)
}

func resolveAllowedOrigins(configuredFrontendURL string) string {
	if raw := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS")); raw != "" {
		origins := uniqueOrigins(strings.Split(raw, ",")...)
		if len(origins) > 0 {
			return strings.Join(origins, ",")
		}
	}

	origins := uniqueOrigins(
		configuredFrontendURL,
		"http://localhost:5173",
		"http://127.0.0.1:5173",
		"http://localhost:5174",
		"http://127.0.0.1:5174",
	)
	return strings.Join(origins, ",")
}

func uniqueOrigins(values ...string) []string {
	seen := make(map[string]struct{}, len(values))
	origins := make([]string, 0, len(values))
	for _, value := range values {
		origin := strings.TrimSpace(value)
		if origin == "" || origin == "*" {
			continue
		}
		if _, ok := seen[origin]; ok {
			continue
		}
		seen[origin] = struct{}{}
		origins = append(origins, origin)
	}
	return origins
}
