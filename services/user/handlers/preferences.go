package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/user/db"
	"github.com/maxceban/nextplay/services/user/models"
)

// GetKeywordPreferences handles GET /users/:id/keywords requests
func GetKeywordPreferences(c *fiber.Ctx) error {
	userID := c.Params("id")

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	rows, err := db.DB.Query(
		"SELECT user_id, keyword_id, score FROM user_keyword_preferences WHERE user_id = $1",
		userID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch keyword preferences"})
	}
	defer rows.Close()

	preferences := make([]models.KeywordPreferences, 0)
	for rows.Next() {
		var pref models.KeywordPreferences
		if err := rows.Scan(&pref.UserID, &pref.KeywordID, &pref.Score); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read keyword preferences"})
		}
		preferences = append(preferences, pref)
	}
	if err := rows.Err(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch keyword preferences"})
	}

	return c.JSON(preferences)
}

// GetKeywordPreferences handles GET /users/:id/keywords requests
func AddKeywordPreference(c *fiber.Ctx) error {
	userID := c.Params("id")

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	type preferenceRequest struct {
		KeywordID int `json:"keyword_id"`
		Score     int `json:"score"`
	}

	var req preferenceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.KeywordID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "keyword_id is required"})
	}

	_, err := db.DB.Exec(
		"INSERT INTO user_keyword_preferences (user_id, keyword_id, score) VALUES ($1, $2, $3)",
		userID,
		req.KeywordID,
		req.Score,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to add keyword preference"})
	}
	return c.JSON(fiber.Map{
		"message": "Add keyword preference",
		"user_id": userID,
		"keyword_id": req.KeywordID,
	})
}

// UpdateKeywordPreference handles PUT /users/:id/keywords/:keywordId requests
func UpdateKeywordPreference(c *fiber.Ctx) error {
	userID := c.Params("id")
	keywordID := c.Params("keywordId")

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	type preferenceRequest struct {
		Score int `json:"score"`
	}

	var req preferenceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	_, err := db.DB.Exec(
		"UPDATE user_keyword_preferences SET score = $1 WHERE user_id = $2 AND keyword_id = $3",
		req.Score,
		userID,
		keywordID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update keyword preference"})
	}
	return c.JSON(fiber.Map{
		"message":    "Update keyword preference",
		"user_id":    userID,
		"keyword_id": keywordID,
	})
}

// DeleteKeywordPreference handles DELETE /users/:id/keywords/:keywordId requests
func DeleteKeywordPreference(c *fiber.Ctx) error {
	userID := c.Params("id")
	keywordID := c.Params("keywordId")

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	_, err := db.DB.Exec(
		"DELETE FROM user_keyword_preferences WHERE user_id = $1 AND keyword_id = $2",
		userID,
		keywordID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete keyword preference"})
	}
	return c.JSON(fiber.Map{
		"message":    "Delete keyword preference",
		"user_id":    userID,
		"keyword_id": keywordID,
	})
}

// GetPlatformPreferences handles GET /users/:id/platforms requests
func GetPlatformPreferences(c *fiber.Ctx) error {
	userID := c.Params("id")

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	rows, err := db.DB.Query(
		"SELECT user_id, platform_id, score FROM user_platform_preferences WHERE user_id = $1",
		userID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch platform preferences"})
	}
	defer rows.Close()

	preferences := make([]models.PlatformPreferences, 0)
	for rows.Next() {
		var pref models.PlatformPreferences
		if err := rows.Scan(&pref.UserID, &pref.PlatformID, &pref.Score); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read platform preferences"})
		}
		preferences = append(preferences, pref)
	}
	if err := rows.Err(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch platform preferences"})
	}

	return c.JSON(preferences)
}

// AddPlatformPreference handles POST /users/:id/platforms requests
func AddPlatformPreference(c *fiber.Ctx) error {
	userID := c.Params("id")

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	type preferenceRequest struct {
		PlatformID int `json:"platform_id"`
		Score      int `json:"score"`
	}

	var req preferenceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.PlatformID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "platform_id is required"})
	}

	_, err := db.DB.Exec(
		"INSERT INTO user_platform_preferences (user_id, platform_id, score) VALUES ($1, $2, $3)",
		userID,
		req.PlatformID,
		req.Score,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to add platform preference"})
	}
	return c.JSON(fiber.Map{
		"message": "Add platform preference",
		"user_id": userID,
		"platform_id": req.PlatformID,
	})
}

// UpdatePlatformPreference handles PUT /users/:id/platforms/:platformId requests
func UpdatePlatformPreference(c *fiber.Ctx) error {
	userID := c.Params("id")
	platformID := c.Params("platformId")

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	type preferenceRequest struct {
		Score int `json:"score"`
	}

	var req preferenceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	_, err := db.DB.Exec(
		"UPDATE user_platform_preferences SET score = $1 WHERE user_id = $2 AND platform_id = $3",
		req.Score,
		userID,
		platformID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update platform preference"})
	}
	return c.JSON(fiber.Map{
		"message":     "Update platform preference",
		"user_id":     userID,
		"platform_id": platformID,
	})
}

func DeletePlatformPreference(c *fiber.Ctx) error {
	userID := c.Params("id")
	platformID := c.Params("platformId")

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	_, err := db.DB.Exec(
		"DELETE FROM user_platform_preferences WHERE user_id = $1 AND platform_id = $2",
		userID,
		platformID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete platform preference"})
	}
	return c.JSON(fiber.Map{
		"message":     "Delete platform preference",
		"user_id":     userID,
		"platform_id": platformID,
	})
}
