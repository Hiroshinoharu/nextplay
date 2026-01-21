package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/game/db"
)

func GetGameKeywords(c *fiber.Ctx) error {
	idParam := c.Params("id")

	gameID, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	rows, err := db.DB.Query(`SELECT keyword_id FROM game_keywords WHERE game_id=$1`, gameID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	keywordIDs := make([]int64, 0)
	for rows.Next() {
		var keywordID int64
		if err := rows.Scan(&keywordID); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		keywordIDs = append(keywordIDs, keywordID)
	}
	if err := rows.Err(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"game_id":     gameID,
		"keywords":    keywordIDs,
	})
}

func AddGameKeyword(c *fiber.Ctx) error {
	idParam := c.Params("id")

	gameID, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	var payload struct {
		KeywordID int64 `json:"keyword_id"`
	}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
	}
	if payload.KeywordID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid keyword ID"})
	}

	_, err = db.DB.Exec(
		`INSERT INTO game_keywords (game_id, keyword_id) VALUES ($1, $2)`,
		gameID,
		payload.KeywordID,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":    "Add keyword to game",
		"game_id":    gameID,
		"keyword_id": payload.KeywordID,
	})
}

func RemoveGameKeyword(c *fiber.Ctx) error {
	idParam := c.Params("id")
	keywordParam := c.Params("keywordId")

	gameID, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid game ID"})
	}

	keywordID, err := strconv.ParseInt(keywordParam, 10, 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid keyword ID"})
	}

	_, err = db.DB.Exec(`DELETE FROM game_keywords WHERE game_id=$1 AND keyword_id=$2`, gameID, keywordID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{
		"message":    "Remove keyword from game",
		"game_id":    gameID,
		"keyword_id": keywordID,
	})
}
