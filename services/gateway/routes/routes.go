package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/gateway/handlers"
	middleware "github.com/maxceban/nextplay/services/gateway/middlewares"
)

// SetUpRoutes registers gateway routes, middleware, and downstream proxy handlers.
func SetUpRoutes(app *fiber.App) {
	authRateLimiter := middleware.NewAuthRateLimiter()
	availabilityRateLimiter := middleware.NewAvailabilityRateLimiter()

	api := app.Group("/api")
	api.Use(middleware.RequireCSRF)

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
		users.Get("/availability", availabilityRateLimiter, handlers.CheckUserAvailability)
		users.Get("/csrf", handlers.GetCSRFToken)
		users.Post("/register", authRateLimiter, handlers.RegisterUser)
		users.Post("/login", authRateLimiter, handlers.LoginUser)
		users.Post("/logout", handlers.LogoutUser)

		securedUsers := users.Group("/:id", middleware.RequireJWT, middleware.RequireSameUserParam("id"))

		securedUsers.Get("/", handlers.GetUserByID)
		securedUsers.Put("/", handlers.UpdateUser)
		securedUsers.Patch("/password", authRateLimiter, handlers.ChangePassword)
		securedUsers.Delete("/", handlers.DeleteUser)

		securedUsers.Get("/interactions", handlers.GetUserInteraction)
		securedUsers.Post("/interactions", handlers.CreateUserInteraction)
		securedUsers.Delete("/interactions/:gameId", handlers.DeleteUserInteraction)
		securedUsers.Get("/interactions/events", handlers.GetUserInteractionEvents)
		securedUsers.Post("/interactions/events", handlers.CreateUserInteractionEvent)
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
		games.Get("/questionnaire-facets", middleware.RequireJWT, handlers.GetQuestionnaireFacets)
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
