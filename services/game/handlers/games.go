package handlers

import (
	"database/sql"
	"math"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/game/models"
)

// GET /api/games - retrieves a paged list of games
func GetAllGames(c *fiber.Ctx) error {
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
	randomOrder := c.Query("random") == "true" || c.Query("random") == "1"
	excludeNonBaseContent := c.Query("exclude_non_base") == "true" || c.Query("exclude_non_base") == "1"

	games, err := getGamesFromStore(limit, offset, includeMedia, upcomingOnly, searchQuery, randomOrder, excludeNonBaseContent)
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
	excludeNonBaseContent := c.Query("exclude_non_base") == "true" || c.Query("exclude_non_base") == "1"

	games, err := searchGamesByNameFromStore(query, mode, limit, offset, includeMedia, excludeNonBaseContent)
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
	games, err := getPopularGamesFromStore(year, limit, offset, minRatingCount, includeMedia)
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
	if limit > 200 {
		limit = 200
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

	games, err := getTopGamesFromStore(limit, offset, minRatingCount, priorVotes, popularityWeight, includeMedia)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(games)
}

// GET /api/games/questionnaire-facets - retrieves catalog-aware questionnaire facets.
func GetQuestionnaireFacets(c *fiber.Ctx) error {
	facets, err := getQuestionnaireFacetsFromStore()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(facets)
}

// GET /api/games/:id - retrieves a game by ID
func GetGameByID(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	game, err := getGameByIDFromStore(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if game == nil {
		return c.Status(404).JSON(fiber.Map{"error": "Game not found"})
	}

	platforms, platformNames, keywords, franchises, companies, series, err := getGameRelationsFromStore(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	media, err := getGameMediaFromStore(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	game.Platforms = platforms
	game.PlatformNames = platformNames
	game.Keywords = keywords
	game.Franchises = franchises
	game.Companies = companies
	game.Series = series
	game.Media = media

	return c.JSON(game)
}

// GET /api/games/:id/related-content - retrieves related base titles by franchise/series
func GetRelatedAddOnContent(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	limit := c.QueryInt("limit", 24)
	if limit <= 0 {
		limit = 24
	}
	if limit > 100 {
		limit = 100
	}
	includeMedia := c.Query("include_media") == "true" || c.Query("include_media") == "1"

	games, err := getRelatedAddOnContentFromStore(id, limit, includeMedia)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(games)
}

// GET /api/games/:id/additional-content - retrieves explicit additional-content records for a game.
func GetAdditionalContent(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	limit := c.QueryInt("limit", 36)
	if limit <= 0 {
		limit = 36
	}
	if limit > 100 {
		limit = 100
	}
	includeMedia := c.Query("include_media") == "true" || c.Query("include_media") == "1"

	games, err := getAdditionalContentFromStore(id, limit, includeMedia)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(games)
}

// CreateGame handles POST /games requests.
func CreateGame(c *fiber.Ctx) error {
	var game models.Game
	if err := c.BodyParser(&game); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
	}

	id, err := createGameInStore(&game)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Failed to create game",
			"details": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Game created successfully",
		"game_id": id,
	})
}

// UpdateGame handles PUT /games/:id requests.
func UpdateGame(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	var game models.Game
	if err := c.BodyParser(&game); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
	}

	err = updateGameInStore(id, &game)
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

	return c.JSON(fiber.Map{
		"message": "Game updated successfully",
		"game_id": id,
	})
}

// DeleteGame handles DELETE /games/:id requests.
func DeleteGame(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	err = deleteGameFromStore(id)
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

	return c.JSON(fiber.Map{
		"message": "Game deleted successfully",
		"game_id": id,
	})
}
