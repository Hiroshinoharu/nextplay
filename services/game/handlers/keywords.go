package handlers

import "github.com/gofiber/fiber/v2"

func GetGameKeywords(c *fiber.Ctx) error {
	id := c.Params("id")

	// TODO: SELECT keyword_id FROM game_keywords WHERE game_id=$1
	return c.JSON(fiber.Map{
		"message": "Get keywords for game",
		"game_id": id,
	})
}

func AddGameKeyword(c *fiber.Ctx) error {
	id := c.Params("id")

	// TODO: INSERT INTO game_keywords
	return c.JSON(fiber.Map{
		"message": "Add keyword to game",
		"game_id": id,
	})
}

func RemoveGameKeyword(c *fiber.Ctx) error {
	id := c.Params("id")
	keywordID := c.Params("keywordId")

	// TODO: DELETE FROM game_keywords WHERE game_id=$1 AND keyword_id=$2
	return c.JSON(fiber.Map{
		"message":    "Remove keyword from game",
		"game_id":    id,
		"keyword_id": keywordID,
	})
}
