package main

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/game/db"
	"github.com/maxceban/nextplay/services/game/routes"
	"github.com/maxceban/nextplay/services/shared/config"
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
