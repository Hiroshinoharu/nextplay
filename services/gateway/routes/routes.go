package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/gateway/handlers"
	"github.com/maxceban/nextplay/services/gateway/middlewares"
)

func SetUpRoutes(app *fiber.App) {

	api := app.Group("/api")

	// --------------------------
	// HEALTH ROUTES
	// --------------------------
	health := api.Group("/health")
	{
		// Public health endpoints
		health.Get("/", handlers.GetAllHealth)
		health.Get("/gateway", handlers.GetGatewayHealth)
		health.Get("/user", handlers.GetUserHealth)
		health.Get("/game", handlers.GetGameHealth)
		health.Get("/recommender", handlers.GetRecommenderHealth)
	}

	// --------------------------
	// USER ROUTES
	// --------------------------
	users := api.Group("/users")
	{
		users.Post("/register", handlers.RegisterUser)
		users.Post("/login", handlers.LoginUser)

		securedUsers := users.Group("/:id", middleware.RequireJWT, middleware.RequireSameUserParam("id"))

		securedUsers.Get("/", handlers.GetUserByID)
		securedUsers.Put("/", handlers.UpdateUser)
		securedUsers.Delete("/", handlers.DeleteUser)

		securedUsers.Get("/interactions", handlers.GetUserInteraction)
		securedUsers.Post("/interactions", handlers.CreateUserInteraction)
		securedUsers.Delete("/interactions/:gameId", handlers.DeleteUserInteraction)

		securedUsers.Get("/keywords", handlers.GetUserKeywordPreferences)
		securedUsers.Post("/keywords", handlers.CreateUserKeywordPreference)
		securedUsers.Put("/keywords/:keywordId", handlers.UpdateUserKeywordPreference)
		securedUsers.Delete("/keywords/:keywordId", handlers.DeleteUserKeywordPreference)

		securedUsers.Get("/platforms", handlers.GetUserPlatformPreferences)
		securedUsers.Post("/platforms", handlers.CreateUserPlatformPreference)
		securedUsers.Put("/platforms/:platformId", handlers.UpdateUserPlatformPreference)
		securedUsers.Delete("/platforms/:platformId", handlers.DeleteUserPlatformPreference)
	}

	// --------------------------
	// GAME ROUTES (UPDATED)
	// --------------------------
	games := api.Group("/games")
	{
		// Popular endpoint remains public for landing-page usage.
		games.Get("/popular", handlers.GetPopularGames)

		// User-facing read endpoints require JWT.
		games.Get("/", middleware.RequireJWT, handlers.GetAllGames)
		games.Get("/search", middleware.RequireJWT, handlers.SearchGamesByName)
		games.Get("/top", middleware.RequireJWT, handlers.GetTopGames)
		games.Get("/:id", middleware.RequireJWT, handlers.GetGameByID)
		games.Get("/:id/related-content", middleware.RequireJWT, handlers.GetRelatedAddOnContent)

		// Internal operation routes
		games.Post("/", middleware.RequireServiceAuth, handlers.CreateGame)
		games.Put("/:id", middleware.RequireServiceAuth, handlers.UpdateGame)
		games.Delete("/:id", middleware.RequireServiceAuth, handlers.DeleteGame)

		// Platforms
		games.Get("/:id/platforms", middleware.RequireJWT, handlers.GetGamePlatforms)
		games.Post("/:id/platforms", middleware.RequireServiceAuth, handlers.AddGamePlatform)
		games.Delete("/:id/platforms/:platformId", middleware.RequireServiceAuth, handlers.RemoveGamePlatform)

		// Keywords
		games.Get("/:id/keywords", middleware.RequireJWT, handlers.GetGameKeywords)

		games.Post("/:id/keywords", middleware.RequireServiceAuth, handlers.AddGameKeyword)
		games.Delete("/:id/keywords/:keywordId", middleware.RequireServiceAuth, handlers.RemoveGameKeyword)

		// Companies
		games.Get("/:id/companies", middleware.RequireJWT, handlers.GetGameCompanies)

		games.Post("/:id/companies", middleware.RequireServiceAuth, handlers.AddGameCompany)
		games.Delete("/:id/companies/:companyId", middleware.RequireServiceAuth, handlers.RemoveGameCompany)

		// Franchise
		games.Get("/:id/franchise", middleware.RequireJWT, handlers.GetGameFranchises)
		games.Post("/:id/franchise", middleware.RequireServiceAuth, handlers.AddGameFranchise)
		games.Delete("/:id/franchise/:franchiseId", middleware.RequireServiceAuth, handlers.RemoveGameFranchise)

		// Series
		games.Get("/:id/series", middleware.RequireJWT, handlers.GetGameSeries)
		games.Post("/:id/series", middleware.RequireServiceAuth, handlers.AddGameSeries)
		games.Delete("/:id/series/:seriesId", middleware.RequireServiceAuth, handlers.RemoveGameSeries)
	}

	// --------------------------
	// RECOMMENDER ROUTES
	// --------------------------
	rec := api.Group("/recommend")
	{
		securedRec := rec.Group("/", middleware.RequireJWT)

		securedRec.Post("/", handlers.RecommendFromFeatures)
		securedRec.Get("/user/:id", middleware.RequireSameUserParam("id"), handlers.GetUserRecommendations)
		securedRec.Get("/item/:id", handlers.GetItemRecommendations)
		securedRec.Post("/item", handlers.PostItemRecommendations)
	}
}
