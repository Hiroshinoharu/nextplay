package main

import (
	"log"
	"os"
	"path/filepath"
	"runtime"

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

	app := fiber.New()
	app.Use(observability.AccessLog("game"))

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
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
