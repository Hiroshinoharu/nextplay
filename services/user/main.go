package main

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/user/db"
	"github.com/maxceban/nextplay/services/user/routes"
	"github.com/maxceban/nextplay/services/shared/config"
)

func main() {
	cfg, err := config.Load(config.Defaults{
		Port: "8082",
		DatabaseURL: "postgres://nextplay:nextplay@localhost:5432/nextplay?sslmode=disable",
	})
	if err != nil {
		log.Fatal("Failed to load config: ", err)
	}

	// attempts to connect to database
	if err := db.Connect(cfg.DatabaseURL); err != nil {
		log.Fatal("Failed to connect to DB: ", err)
	}

	app := fiber.New()

	// Health Endpoint
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"service": "user",
			"status":  "running",
		})
	})

	// Setup routes
	routes.SetUpRoutes(app)

	app.Listen(":" + cfg.Port)
}
