package handlers

import "github.com/gofiber/fiber/v2"

func GetGameSeries(c *fiber.Ctx) error {
	id := c.Params("id")

	// TODO: SELECT series_id FROM game_series WHERE game_id=$1
	return c.JSON(fiber.Map{
		"message": "Get series for game",
		"game_id": id,
	})
}

func AddGameSeries(c *fiber.Ctx) error {
	id := c.Params("id")

	// TODO: INSERT INTO game_series
	return c.JSON(fiber.Map{
		"message": "Add game to series",
		"game_id": id,
	})
}

func RemoveGameSeries(c *fiber.Ctx) error {
	id := c.Params("id")
	seriesID := c.Params("seriesId")

	// TODO: DELETE FROM game_series WHERE game_id=$1 AND series_id=$2
	return c.JSON(fiber.Map{
		"message":   "Remove game from series",
		"game_id":   id,
		"series_id": seriesID,
	})
}
