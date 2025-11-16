package routes

import (
	"gateway/handlers"

	"github.com/gofiber/fiber/v2"
)

func SetUpRoutes(app *fiber.App) {

	api := app.Group("/api")

	// User Routes
	users := api.Group("/users")
	users.Get("/:id", handlers.GetUserByID)
	users.Post("/", handlers.CreateUser)

	// Game Routes
	games := api.Group("/games")
	games.Get("/", handlers.GetAllGames)
	games.Get("/:id", handlers.GetGameByID)

	// Recommender Routes
	rec := api.Group("/recommend")
	rec.Post("/", handlers.GetRecommendations)
	rec.Get("/user/:id", handlers.GetUserRecommendations)
}
