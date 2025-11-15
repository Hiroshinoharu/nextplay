package handlers

import "github.com/gofiber/fiber/v2"

func GetGameFranchises(c *fiber.Ctx) error {
	id := c.Params("id")

	// TODO: SELECT franchise_id FROM game_franchise WHERE game_id=$1
	return c.JSON(fiber.Map{
		"message": "Get franchises for game",
		"game_id": id,
	})
}

func AddGameFranchise(c *fiber.Ctx) error {
	id := c.Params("id")

	// TODO: INSERT INTO game_franchise
	return c.JSON(fiber.Map{
		"message": "Add franchise to game",
		"game_id": id,
	})
}

func RemoveGameFranchise(c *fiber.Ctx) error {
	id := c.Params("id")
	franchiseID := c.Params("franchiseId")

	// TODO: DELETE FROM game_franchise WHERE game_id=$1 AND franchise_id=$2
	return c.JSON(fiber.Map{
		"message":      "Remove franchise from game",
		"game_id":      id,
		"franchise_id": franchiseID,
	})
}
