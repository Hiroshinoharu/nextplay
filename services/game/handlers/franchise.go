package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/game/db"
)

func GetGameFranchises(c *fiber.Ctx) error {
	idParam := c.Params("id")

	gameID, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	rows, err := db.DB.Query(`SELECT franchise_id FROM game_franchise WHERE game_id=$1`, gameID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	franchiseIDs := make([]int64, 0)
	for rows.Next() {
		var franchiseID int64
		if err := rows.Scan(&franchiseID); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		franchiseIDs = append(franchiseIDs, franchiseID)
	}
	if err := rows.Err(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"game_id":        gameID,
		"franchise_ids":  franchiseIDs,
	})
}

func AddGameFranchise(c *fiber.Ctx) error {
	idParam := c.Params("id")

	gameID, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	var payload struct {
		FranchiseID int64 `json:"franchise_id"`
	}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
	}
	if payload.FranchiseID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid franchise ID"})
	}

	_, err = db.DB.Exec(
		`INSERT INTO game_franchise (game_id, franchise_id) VALUES ($1, $2)`,
		gameID,
		payload.FranchiseID,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":      "Add franchise to game",
		"game_id":      gameID,
		"franchise_id": payload.FranchiseID,
	})
}

func RemoveGameFranchise(c *fiber.Ctx) error {
	id := c.Params("id")
	franchiseID := c.Params("franchiseId")

	gameID, err := strconv.Atoi(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	franchiseIDInt, err := strconv.Atoi(franchiseID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid franchise ID"})
	}

	if _, err := db.DB.Exec(
		`DELETE FROM game_franchise WHERE game_id=$1 AND franchise_id=$2`,
		gameID,
		franchiseIDInt,
	); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":      "Remove franchise from game",
		"game_id":      id,
		"franchise_id": franchiseID,
	})
}
