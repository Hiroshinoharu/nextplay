package handlers

import (
	"database/sql"
	"math"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/game/db"
	"github.com/maxceban/nextplay/services/game/models"
)

// GET /api/games - retrieves a paged list of games
func GetAllGames(c *fiber.Ctx) error {
	// Parse query parameters for pagination and filtering options with default values and limits to prevent abuse and ensure reasonable defaults for the frontend and to avoid overwhelming the database with large requests
	limit := c.QueryInt("limit", 50)
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	offset := c.QueryInt("offset", 0)
	if offset < 0 {
		offset = 0
	}
	includeMedia := c.Query("include_media") == "true" || c.Query("include_media") == "1"
	upcomingOnly := c.Query("upcoming") == "true" || c.Query("upcoming") == "1"
	searchQuery := strings.TrimSpace(c.Query("q"))

	games, err := db.GetGames(limit, offset, includeMedia, upcomingOnly, searchQuery)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(games)
}

// GET /api/games/search - retrieves games by name using a direct DB query
func SearchGamesByName(c *fiber.Ctx) error {
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "query parameter q is required"})
	}
	limit := c.QueryInt("limit", 200)
	if limit < 0 {
		limit = 0
	}
	if limit > 1000 {
		limit = 1000
	}
	offset := c.QueryInt("offset", 0)
	if offset < 0 {
		offset = 0
	}
	includeMedia := c.Query("include_media") == "true" || c.Query("include_media") == "1"
	mode := strings.TrimSpace(c.Query("mode"))

	games, err := db.SearchGamesByName(query, mode, limit, offset, includeMedia)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(games)
}

// GET /api/games/popular - retrieves most popular games for a given year
func GetPopularGames(c *fiber.Ctx) error {
	year := c.QueryInt("year", 0)
	limit := c.QueryInt("limit", 4)
	offset := c.QueryInt("offset", 0)
	minRatingCount := c.QueryInt("min_rating_count", 50)
	if limit > 300 {
		limit = 300
	}
	if offset < 0 {
		offset = 0
	}
	if minRatingCount < 0 {
		minRatingCount = 0
	}
	includeMedia := c.Query("include_media") == "true" || c.Query("include_media") == "1"
	games, err := db.GetPopularGames(year, limit, offset, minRatingCount, includeMedia)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(games)
}

// GET /api/games/top - retrieves top all-time games using weighted rating.
func GetTopGames(c *fiber.Ctx) error {
	limit := c.QueryInt("limit", 10)
	offset := c.QueryInt("offset", 0)
	minRatingCount := c.QueryInt("min_rating_count", 1000)
	priorVotes := c.QueryInt("prior_votes", 200)
	popularityWeight := c.QueryFloat("popularity_weight", 0)
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	if minRatingCount < 0 {
		minRatingCount = 0
	}
	if priorVotes <= 0 {
		priorVotes = 200
	}
	if math.IsNaN(popularityWeight) || math.IsInf(popularityWeight, 0) || popularityWeight < 0 {
		popularityWeight = 0
	}
	includeMedia := c.Query("include_media") == "true" || c.Query("include_media") == "1"

	games, err := db.GetTopGames(limit, offset, minRatingCount, priorVotes, popularityWeight, includeMedia)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(games)
}

// GET /api/games/:id - retrieves a game by ID
func GetGameByID(c *fiber.Ctx) error {
	// Get game ID from URL params
	idParam := c.Params("id")

	// Convert ID to integer
	id, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	// Call DB function to get game details

	// Fetch game details
	game, err := db.GetGameByID(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// If game not found, return 404
	if game == nil {
		return c.Status(404).JSON(fiber.Map{"error": "Game not found"})
	}

	// Fetch related entity IDs and media for the game
	platforms, platformNames, keywords, franchises, companies, series, err := db.GetGameRelations(id)
	// Note: GetGameRelations now also returns platform names for easier frontend display
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	// Fetch media separately
	media, err := db.GetGameMedia(id)
	// Note: GetGameMedia is a new function that retrieves media entries for the game
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	// Populate the game struct with related entity IDs, platform names, and media
	game.Platforms = platforms
	game.PlatformNames = platformNames
	game.Keywords = keywords
	game.Franchises = franchises
	game.Companies = companies
	game.Series = series
	game.Media = media

	// Return the game details as JSON
	return c.JSON(game)
}

func CreateGame(c *fiber.Ctx) error {
	// Parse incoming JSON into Game struct
	var game models.Game

	// Bind JSON body to game struct
	if err := c.BodyParser(&game); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
	}

	// Call DB function to insert
	id, err := db.CreateGame(&game)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to create game",
			"details": err.Error(),
		})
	}

	// Return the created game ID
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Game created successfully",
		"game_id": id,
	})
}

func UpdateGame(c *fiber.Ctx) error {
	// Get game ID from URL params
	idParam := c.Params("id")

	// Convert ID to integer
	id, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	// Parse incoming JSON into Game struct
	var game models.Game
	if err := c.BodyParser(&game); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			`error`:   "Invalid request body",
			`details`: err.Error(),
		})
	}

	// Call DB function to update
	err = db.UpdateGame(id, &game)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Game not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to update game",
			"details": err.Error(),
		})
	}

	// Return success message
	return c.JSON(fiber.Map{
		"message": "Game updated successfully",
		"game_id": id,
	})
}

func DeleteGame(c *fiber.Ctx) error {
	// Get game ID from URL params
	idParam := c.Params("id")

	// Convert ID to integer
	id, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	// Call DB function to delete
	err = db.DeleteGame(id)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Game not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to delete game",
			"details": err.Error(),
		})
	}

	// Return success message
	return c.JSON(fiber.Map{
		"message": "Game deleted successfully",
		"game_id": id,
	})
}
