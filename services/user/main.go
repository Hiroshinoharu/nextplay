package main

import (
	"log"
	"os"
	"user/db"
	"user/routes"

	"github.com/gofiber/fiber/v2"
)

func main(){
	// attempts to connect to database
	if err := db.Connect(); err != nil{
		log.Fatal("Failed to connect to DB: ", err)
	}

	app:= fiber.New()

	// Health Endpoint
	app.Get("/", func(c *fiber.Ctx) error{
		return c.JSON(fiber.Map{"service": "user", "status": "runnning"})
	})

	// Setup routes
	routes.SetUpRoutes(app)

	port := os.Getenv("PORT")
	if port == ""{
		port = "8083"
	}

	app.Listen(":" + port)
}