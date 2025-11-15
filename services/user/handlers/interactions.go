package handlers

import (
	"github.com/gofiber/fiber/v2"
)

func GetInteractions(c *fiber.Ctx) error {
	userID := c.Params("id")

	// TODO: SELECT * FROM user_interactions WHERE user_id = $1
	return c.JSON(fiber.Map{
		"message": "Get user interactions",
		"user_id": userID,
	})
}

func AddOrUpdateInteraction(c *fiber.Ctx) error {
	userID := c.Params("id")

	// TODO: INSERT or UPDATE depending on if exists
	return c.JSON(fiber.Map{
		"message": "Add/Update interaction",
		"user_id": userID,
	})
}

func DeleteInteraction(c *fiber.Ctx) error {
	userID := c.Params("id")
	gameID := c.Params("gameId")

	// TODO: DELETE FROM user_interactions WHERE user_id=$1 AND game_id=$2
	return c.JSON(fiber.Map{
		"message": "Delete interaction",
		"user_id": userID,
		"game_id": gameID,
	})
}
