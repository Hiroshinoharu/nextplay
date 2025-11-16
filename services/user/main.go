package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/user/db"
	"github.com/maxceban/nextplay/services/user/routes"
)

func main() {
	// attempts to connect to database
	if err := db.Connect(); err != nil {
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

	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}

	app.Listen(":" + port)
}
