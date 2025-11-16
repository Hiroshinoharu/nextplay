package main

import (
	"os"

	"github.com/gofiber/fiber/v2"
)

func main(){
	app:= fiber.New()

	app.Get("/health", func(c *fiber.Ctx) error{
		return c.JSON(fiber.Map{"service": "gateway", "status": "runnning"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8084"
	}

	app.Listen(":" + port)
}