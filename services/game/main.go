package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/game/db"
	"github.com/maxceban/nextplay/services/game/routes"
)

func main() {
	// attempts to connect to database
	if err := db.Connect(); err != nil {
		log.Fatal("Failed to connect to DB: ", err)
	}

	app := fiber.New()

	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"service": "game",
			"status":  "runnning",
		})
	})

	// Setup routes
	routes.SetUpRoutes(app)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	app.Listen(":" + port)
}
