package handlers

import "github.com/gofiber/fiber/v2"

func GetGamePlatforms(c *fiber.Ctx) error {
	id := c.Params("id")

	// TODO: SELECT platform_id FROM game_platform WHERE game_id=$1
	return c.JSON(fiber.Map{
		"message": "Get platforms for game",
		"game_id": id,
	})
}

func AddGamePlatform(c *fiber.Ctx) error {
	id := c.Params("id")

	// TODO: INSERT INTO game_platform (game_id, platform_id)
	return c.JSON(fiber.Map{
		"message": "Add platform to game",
		"game_id": id,
	})
}

func RemoveGamePlatform(c *fiber.Ctx) error {
	id := c.Params("id")
	platformID := c.Params("platformId")

	// TODO: DELETE FROM game_platform WHERE game_id=$1 AND platform_id=$2
	return c.JSON(fiber.Map{
		"message":     "Remove platform from game",
		"game_id":     id,
		"platform_id": platformID,
	})
}
