package routes

import (
	"github.com/maxceban/nextplay/services/gateway/handlers"
	"github.com/gofiber/fiber/v2"
)

func SetUpRoutes(app *fiber.App) {

	// -------- Health Check --------
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "gateway"})
	})

	// Top-level API group
	api := app.Group("/api")

	// -------- USER ROUTES --------
	users := api.Group("/users")
	{
		// More specific routes MUST be BEFORE /:id
		users.Get("/:id/preferences", handlers.GetUserPreferences)
		users.Get("/:id/interactions", handlers.GetUserInteraction)

		users.Get("/:id", handlers.GetUserByID)
		users.Post("/", handlers.CreateUser)
		users.Post("/login", handlers.LoginUser)
	}

	// -------- GAME ROUTES --------
	games := api.Group("/games")
	{
		games.Get("/", handlers.GetAllGames)

		// Specific routes first
		games.Get("/:id/companies", handlers.GetGameCompanies)
		games.Get("/:id/platforms", handlers.GetGamePlatforms)
		games.Get("/:id/keywords", handlers.GetGameKeywords)

		games.Get("/:id", handlers.GetGameByID)
	}

	// -------- RECOMMENDER ROUTES --------
	rec := api.Group("/recommend")
	{
		rec.Post("/", handlers.RecommendFromFeatures)
		rec.Get("/user/:id", handlers.GetUserRecommendations)
	}
}