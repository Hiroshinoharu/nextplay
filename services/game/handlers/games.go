package handlers

import (
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

	return c.JSON(game)
}

func CreateGame(c *fiber.Ctx) error {
	// Parse incoming JSON into Game struct
	var game models.Game

	// Bind JSON body to game struct
	if err := c.BodyParser(&game); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
			"details": err.Error(),
		})
	}

	// Call DB function to insert
	id, err := db.CreateGame(&game)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create game",
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
	id := c.Params("id")

	// TODO: Parse JSON
	// TODO: UPDATE game SET … WHERE game_id=$1
	return c.JSON(fiber.Map{
		"message": "Update game",
		"game_id": id,
	})
}

func DeleteGame(c *fiber.Ctx) error {
	id := c.Params("id")

	// TODO: DELETE FROM game WHERE game_id=$1
	return c.JSON(fiber.Map{
		"message": "Delete game",
		"game_id": id,
	})
}