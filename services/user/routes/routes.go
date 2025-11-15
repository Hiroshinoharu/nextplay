package routes

import (
	"user/handlers"

	"github.com/gofiber/fiber/v2"
)

func SetUpRoutes(app *fiber.App){
	api := app.Group("/users")

	api.Post("/register", handlers.Register)
	api.Post("/login", handlers.Login)

	api.Get("/:id/preferences/keywords", handlers.GetKeywordPrefernces)
	api.Get("/:id/preferences/platforms", handlers.GetKeywordPrefernces)

	api.Get("/:id/interactions", handlers.GetInteractions)
    api.Post("/:id/interactions", handlers.CreateOrUpdateInteraction)
}