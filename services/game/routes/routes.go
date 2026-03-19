package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/game/handlers"
	"github.com/maxceban/nextplay/services/game/middleware"
)

// SetUpRoutes registers the game service routes and relationship endpoints.
func SetUpRoutes(app *fiber.App) {

	// ------------------------------------
	// BASE ROUTES: Games (Read-Only + Create)
	// ------------------------------------
	games := app.Group("/games")

	games.Get("/", handlers.GetAllGames)             // List all games
	games.Get("/search", handlers.SearchGamesByName) // Search games by name
	games.Get("/popular", handlers.GetPopularGames)  // List popular games
	games.Get("/top", handlers.GetTopGames)          // List weighted top games
	games.Get("/questionnaire-facets", handlers.GetQuestionnaireFacets)
	games.Get("/:id", handlers.GetGameByID) // Get one game by ID
	games.Get("/:id/related-content", handlers.GetRelatedAddOnContent)
	games.Post("/", middleware.RequireServiceAuth, handlers.CreateGame)
	games.Put("/:id", middleware.RequireServiceAuth, handlers.UpdateGame)
	games.Delete("/:id", middleware.RequireServiceAuth, handlers.DeleteGame)

	// ------------------------------------
	// GAME → PLATFORMS
	// ------------------------------------
	platforms := games.Group("/:id/platforms")

	platforms.Get("/", handlers.GetGamePlatforms) // List platforms for a game
	platforms.Post("/", middleware.RequireServiceAuth, handlers.AddGamePlatform)
	platforms.Delete("/:platformId", middleware.RequireServiceAuth, handlers.RemoveGamePlatform)

	// ------------------------------------
	// GAME → KEYWORDS
	// ------------------------------------
	keywords := games.Group("/:id/keywords")

	keywords.Get("/", handlers.GetGameKeywords) // List keywords for a game
	keywords.Post("/", middleware.RequireServiceAuth, handlers.AddGameKeyword)
	keywords.Delete("/:keywordId", middleware.RequireServiceAuth, handlers.RemoveGameKeyword)

	// ------------------------------------
	// GAME → COMPANIES
	// ------------------------------------
	companies := games.Group("/:id/companies")

	companies.Get("/", handlers.GetGameCompanies)
	companies.Post("/", middleware.RequireServiceAuth, handlers.AddGameCompany)
	companies.Delete("/:companyId", middleware.RequireServiceAuth, handlers.RemoveGameCompany)

	// ------------------------------------
	// GAME → FRANCHISES
	// ------------------------------------
	franchises := games.Group("/:id/franchise")

	franchises.Get("/", handlers.GetGameFranchises)
	franchises.Post("/", middleware.RequireServiceAuth, handlers.AddGameFranchise)
	franchises.Delete("/:franchiseId", middleware.RequireServiceAuth, handlers.RemoveGameFranchise)

	// ------------------------------------
	// GAME → SERIES
	// ------------------------------------
	series := games.Group("/:id/series")

	series.Get("/", handlers.GetGameSeries)
	series.Post("/", middleware.RequireServiceAuth, handlers.AddGameSeries)
	series.Delete("/:seriesId", middleware.RequireServiceAuth, handlers.RemoveGameSeries)
}
