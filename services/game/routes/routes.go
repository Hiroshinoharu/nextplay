package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/game/handlers"
)

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
	games.Post("/", handlers.CreateGame)      // Add a new game (local only)
	games.Put("/:id", handlers.UpdateGame)    // Update a game by ID
	games.Delete("/:id", handlers.DeleteGame) // Delete a game by ID

	// ------------------------------------
	// GAME → PLATFORMS
	// ------------------------------------
	platforms := games.Group("/:id/platforms")

	platforms.Get("/", handlers.GetGamePlatforms) // List platforms for a game
	platforms.Post("/", handlers.AddGamePlatform) // Add platform mapping
	platforms.Delete("/:platformId", handlers.RemoveGamePlatform)

	// ------------------------------------
	// GAME → KEYWORDS
	// ------------------------------------
	keywords := games.Group("/:id/keywords")

	keywords.Get("/", handlers.GetGameKeywords) // List keywords for a game
	keywords.Post("/", handlers.AddGameKeyword) // Add keyword mapping
	keywords.Delete("/:keywordId", handlers.RemoveGameKeyword)

	// ------------------------------------
	// GAME → COMPANIES
	// ------------------------------------
	companies := games.Group("/:id/companies")

	companies.Get("/", handlers.GetGameCompanies)
	companies.Post("/", handlers.AddGameCompany)
	companies.Delete("/:companyId", handlers.RemoveGameCompany)

	// ------------------------------------
	// GAME → FRANCHISES
	// ------------------------------------
	franchises := games.Group("/:id/franchise")

	franchises.Get("/", handlers.GetGameFranchises)
	franchises.Post("/", handlers.AddGameFranchise)
	franchises.Delete("/:franchiseId", handlers.RemoveGameFranchise)

	// ------------------------------------
	// GAME → SERIES
	// ------------------------------------
	series := games.Group("/:id/series")

	series.Get("/", handlers.GetGameSeries)
	series.Post("/", handlers.AddGameSeries)
	series.Delete("/:seriesId", handlers.RemoveGameSeries)
}
