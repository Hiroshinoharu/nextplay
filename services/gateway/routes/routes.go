package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/gateway/handlers"
)

func SetUpRoutes(app *fiber.App) {

	api := app.Group("/api")

	// --------------------------
	// USER ROUTES
	// --------------------------
	users := api.Group("/users")
	{
		users.Get("/:id", handlers.GetUserByID)
		users.Post("/", handlers.CreateUser)
		users.Post("/login", handlers.LoginUser)
		users.Get("/:id/preferences", handlers.GetUserPreferences)
		users.Get("/:id/interactions", handlers.GetUserInteraction)
		users.Post("/:id/preferences", handlers.CreateUserPreference)
		users.Post("/:id/interactions", handlers.CreateUserInteraction)
	}

	// --------------------------
	// GAME ROUTES (UPDATED)
	// --------------------------
	games := api.Group("/games")
	{
		games.Get("/", handlers.GetAllGames)
		games.Get("/:id", handlers.GetGameByID)
		games.Post("/", handlers.CreateGame)

		// Platforms
		games.Get("/:id/platforms", handlers.GetGamePlatforms)
		games.Post("/:id/platforms", handlers.AddGamePlatform)
		games.Delete("/:id/platforms/:platformId", handlers.RemoveGamePlatform)

		// Keywords
		games.Get("/:id/keywords", handlers.GetGameKeywords)
		games.Post("/:id/keywords", handlers.AddGameKeyword)
		games.Delete("/:id/keywords/:keywordId", handlers.RemoveGameKeyword)

		// Companies
		games.Get("/:id/companies", handlers.GetGameCompanies)
		games.Post("/:id/companies", handlers.AddGameCompany)
		games.Delete("/:id/companies/:companyId", handlers.RemoveGameCompany)

		// Franchise
		games.Get("/:id/franchise", handlers.GetGameFranchises)
		games.Post("/:id/franchise", handlers.AddGameFranchise)
		games.Delete("/:id/franchise/:franchiseId", handlers.RemoveGameFranchise)

		// Series
		games.Get("/:id/series", handlers.GetGameSeries)
		games.Post("/:id/series", handlers.AddGameSeries)
		games.Delete("/:id/series/:seriesId", handlers.RemoveGameSeries)
	}

	// --------------------------
	// RECOMMENDER ROUTES
	// --------------------------
	rec := api.Group("/recommend")
	{
		rec.Post("/", handlers.RecommendFromFeatures)
		rec.Get("/user/:id", handlers.GetUserRecommendations)
	}
}
