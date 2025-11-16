package handlers

import (
	"github.com/gofiber/fiber/v2"
)

func GetAllGames(c *fiber.Ctx) error {
	// TODO: SELECT * FROM game
	return c.JSON(fiber.Map{
		"message": "Get all games",
	})
}

func GetGameByID(c *fiber.Ctx) error {
	id := c.Params("id")

	// TODO: SELECT FROM game WHERE game_id=$1
	// TODO: SELECT platforms, keywords, series, companies, franchise
	return c.JSON(fiber.Map{
		"message": "Get game by ID",
		"game_id": id,
	})
}

func CreateGame(c *fiber.Ctx) error {
	// TODO: Parse JSON
	// TODO: INSERT INTO game (...)
	return c.JSON(fiber.Map{
		"message": "Create game",
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