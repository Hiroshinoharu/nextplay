package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/game/db"
)

// GetGamePlatforms handles GET /games/:id/platforms requests
func GetGamePlatforms(c *fiber.Ctx) error {
	idParam := c.Params("id")

	gameID, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	rows, err := db.DB.Query(`SELECT platform_id FROM game_platform WHERE game_id=$1`, gameID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	platformIDs := make([]int64, 0)
	for rows.Next() {
		var platformID int64
		if err := rows.Scan(&platformID); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		platformIDs = append(platformIDs, platformID)
	}
	if err := rows.Err(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"game_id":      gameID,
		"platforms":    platformIDs,
	})
}

// AddGamePlatform handles POST /games/:id/platforms requests
func AddGamePlatform(c *fiber.Ctx) error {
	idParam := c.Params("id")

	gameID, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	var payload struct {
		PlatformID int64 `json:"platform_id"`
	}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
	}
	if payload.PlatformID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid platform ID"})
	}

	_, err = db.DB.Exec(
		`INSERT INTO game_platform (game_id, platform_id) VALUES ($1, $2)`,
		gameID,
		payload.PlatformID,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":     "Add platform to game",
		"game_id":     gameID,
		"platform_id": payload.PlatformID,
	})
}

// RemoveGamePlatform handles DELETE /games/:id/platforms/:platformId requests
func RemoveGamePlatform(c *fiber.Ctx) error {
	idParam := c.Params("id")
	platformParam := c.Params("platformId")

	gameID, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	platformID, err := strconv.ParseInt(platformParam, 10, 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid platform ID"})
	}

	_, err = db.DB.Exec(`DELETE FROM game_platform WHERE game_id=$1 AND platform_id=$2`, gameID, platformID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":     "Remove platform from game",
		"game_id":     gameID,
		"platform_id": platformID,
	})
}
