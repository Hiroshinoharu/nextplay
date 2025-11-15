package routes

import (
	"github.com/maxceban/nextplay/services/game/handlers"

	"github.com/gofiber/fiber/v2"
)

func SetUpRoutes(app *fiber.App) {

	// ----------
	// GAME CRUD
	// ----------
	app.Get("/games", handlers.GetAllGames)
	app.Get("/games/:id", handlers.GetGameByID)
	app.Post("/games", handlers.CreateGame)
	app.Put("/games/:id", handlers.UpdateGame)
	app.Delete("/games/:id", handlers.DeleteGame)

	// -----------------------
	// GAME → PLATFORMS
	// -----------------------
	app.Get("/games/:id/platforms", handlers.GetGamePlatforms)
	app.Post("/games/:id/platforms", handlers.AddGamePlatform)
	app.Delete("/games/:id/platforms/:platformId", handlers.RemoveGamePlatform)

	// -----------------------
	// GAME → KEYWORDS
	// -----------------------
	app.Get("/games/:id/keywords", handlers.GetGameKeywords)
	app.Post("/games/:id/keywords", handlers.AddGameKeyword)
	app.Delete("/games/:id/keywords/:keywordId", handlers.RemoveGameKeyword)

	// -----------------------
	// GAME → COMPANIES
	// -----------------------
	app.Get("/games/:id/companies", handlers.GetGameCompanies)
	app.Post("/games/:id/companies", handlers.AddGameCompany)
	app.Delete("/games/:id/companies/:companyId", handlers.RemoveGameCompany)

	// -----------------------
	// GAME → FRANCHISE
	// -----------------------
	app.Get("/games/:id/franchise", handlers.GetGameFranchises)
	app.Post("/games/:id/franchise", handlers.AddGameFranchise)
	app.Delete("/games/:id/franchise/:franchiseId", handlers.RemoveGameFranchise)

	// -----------------------
	// GAME → SERIES
	// -----------------------
	app.Get("/games/:id/series", handlers.GetGameSeries)
	app.Post("/games/:id/series", handlers.AddGameSeries)
	app.Delete("/games/:id/series/:seriesId", handlers.RemoveGameSeries)
}
