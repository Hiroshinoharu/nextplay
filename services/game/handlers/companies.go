package handlers

import "github.com/gofiber/fiber/v2"

func GetGameCompanies(c *fiber.Ctx) error {
	id := c.Params("id")

	// TODO: SELECT * FROM game_companies WHERE game_id=$1
	return c.JSON(fiber.Map{
		"message": "Get companies for game",
		"game_id": id,
	})
}

func AddGameCompany(c *fiber.Ctx) error {
	id := c.Params("id")

	// TODO: INSERT INTO game_companies
	return c.JSON(fiber.Map{
		"message": "Add company to game",
		"game_id": id,
	})
}

func RemoveGameCompany(c *fiber.Ctx) error {
	id := c.Params("id")
	companyID := c.Params("companyId")

	// TODO: DELETE FROM game_companies WHERE game_id=$1 AND company_id=$2
	return c.JSON(fiber.Map{
		"message":     "Remove company from game",
		"game_id":     id,
		"company_id":  companyID,
	})
}
