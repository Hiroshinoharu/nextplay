package handlers

import (
	"database/sql"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/game/db"
	"github.com/maxceban/nextplay/services/game/models"
)

// GET /api/games - retrieves all games
func GetAllGames(c *fiber.Ctx) error {
	games, err := db.GetAllGames()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(games)
}

// GET /api/games/:id - retrieves a game by ID
func GetGameByID(c *fiber.Ctx) error {
	idParam := c.Params("id")

	id, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	game, err := db.GetGameByID(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if game == nil {
		return c.Status(404).JSON(fiber.Map{"error": "Game not found"})
	}

	platforms, keywords, franchises, companies, series, err := db.GetGameRelations(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	game.Platforms = platforms
	game.Keywords = keywords
	game.Franchises = franchises
	game.Companies = companies
	game.Series = series

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
