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
		securedHealth := health.Group("/health", middleware.RequireJWT)
		
		// Private health endpoints
		securedHealth.Get("/", handlers.GetAllHealth)
		securedHealth.Get("/gateway", handlers.GetGatewayHealth)
		securedHealth.Get("/user", handlers.GetUserHealth)
		securedHealth.Get("/game", handlers.GetGameHealth)
		securedHealth.Get("/recommender", handlers.GetRecommenderHealth)
	}

	// --------------------------
	// USER ROUTES
	// --------------------------
	users := api.Group("/users")
	{

		securedUsers := users.Group("/", middleware.RequireJWT, middleware.RequireSameUserParam("id"))
		
		users.Post("/register", handlers.RegisterUser)
		users.Post("/login", handlers.LoginUser)
		
		securedUsers.Get("/:id", handlers.GetUserByID)
		securedUsers.Put("/:id", handlers.UpdateUser)
		securedUsers.Delete("/:id", handlers.DeleteUser)

		securedUsers.Get("/:id/interactions", handlers.GetUserInteraction)
		securedUsers.Post("/:id/interactions", handlers.CreateUserInteraction)
		securedUsers.Delete("/:id/interactions/:gameId", handlers.DeleteUserInteraction)

		securedUsers.Get("/:id/keywords", handlers.GetUserKeywordPreferences)
		securedUsers.Post("/:id/keywords", handlers.CreateUserKeywordPreference)
		securedUsers.Put("/:id/keywords/:keywordId", handlers.UpdateUserKeywordPreference)
		securedUsers.Delete("/:id/keywords/:keywordId", handlers.DeleteUserKeywordPreference)

		securedUsers.Get("/:id/platforms", handlers.GetUserPlatformPreferences)
		securedUsers.Post("/:id/platforms", handlers.CreateUserPlatformPreference)
		securedUsers.Put("/:id/platforms/:platformId", handlers.UpdateUserPlatformPreference)
		securedUsers.Delete("/:id/platforms/:platformId", handlers.DeleteUserPlatformPreference)
	}

	// --------------------------
	// GAME ROUTES (UPDATED)
	// --------------------------
	games := api.Group("/games")
	{
		// User-facing read routes require JWT.
		securedGames := games.Group("/", middleware.RequireJWT)
		// ETL/admin operation routes require service auth token.
		serviceGames := games.Group("/", middleware.RequireServiceAuth)
		
		securedGames.Get("/", handlers.GetAllGames)
		securedGames.Get("/search", handlers.SearchGamesByName)
		securedGames.Get("/popular", handlers.GetPopularGames)
		securedGames.Get("/top", handlers.GetTopGames)
		securedGames.Get("/:id", handlers.GetGameByID)
		
		// Internal operation routes
		serviceGames.Post("/", handlers.CreateGame)
		serviceGames.Put("/:id", handlers.UpdateGame)
		serviceGames.Delete("/:id", handlers.DeleteGame)

		// Platforms
		securedGames.Get("/:id/platforms", handlers.GetGamePlatforms)
		serviceGames.Post("/:id/platforms", handlers.AddGamePlatform)
		serviceGames.Delete("/:id/platforms/:platformId", handlers.RemoveGamePlatform)

		// Keywords
		securedGames.Get("/:id/keywords", handlers.GetGameKeywords)
		
		serviceGames.Post("/:id/keywords", handlers.AddGameKeyword)
		serviceGames.Delete("/:id/keywords/:keywordId", handlers.RemoveGameKeyword)

		// Companies
		securedGames.Get("/:id/companies", handlers.GetGameCompanies)
		
		serviceGames.Post("/:id/companies", handlers.AddGameCompany)
		serviceGames.Delete("/:id/companies/:companyId", handlers.RemoveGameCompany)

		// Franchise
		securedGames.Get("/:id/franchise", handlers.GetGameFranchises)
		serviceGames.Post("/:id/franchise", handlers.AddGameFranchise)
		serviceGames.Delete("/:id/franchise/:franchiseId", handlers.RemoveGameFranchise)

		// Series
		securedGames.Get("/:id/series", handlers.GetGameSeries)
		serviceGames.Post("/:id/series", handlers.AddGameSeries)
		serviceGames.Delete("/:id/series/:seriesId", handlers.RemoveGameSeries)
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
