package handlers

import (
	"github.com/gofiber/fiber/v2"
)

func GetKeywordPreferences(c *fiber.Ctx) error {
	userID := c.Params("id")

	// TODO: SELECT * FROM user_keyword_preferences WHERE user_id = $1
	return c.JSON(fiber.Map{
		"message": "Get keyword preferences",
		"user_id": userID,
	})
}

func AddKeywordPreference(c *fiber.Ctx) error {
	userID := c.Params("id")

	// TODO: INSERT INTO user_keyword_preferences
	return c.JSON(fiber.Map{
		"message": "Add keyword preference",
		"user_id": userID,
	})
}

func UpdateKeywordPreference(c *fiber.Ctx) error {
	userID := c.Params("id")
	keywordID := c.Params("keywordId")

	// TODO: UPDATE user_keyword_preferences SET score=...
	return c.JSON(fiber.Map{
		"message":    "Update keyword preference",
		"user_id":    userID,
		"keyword_id": keywordID,
	})
}

func DeleteKeywordPreference(c *fiber.Ctx) error {
	userID := c.Params("id")
	keywordID := c.Params("keywordId")

	// TODO: DELETE FROM user_keyword_preferences WHERE user_id=$1 AND keyword_id=$2
	return c.JSON(fiber.Map{
		"message":    "Delete keyword preference",
		"user_id":    userID,
		"keyword_id": keywordID,
	})
}

func GetPlatformPreferences(c *fiber.Ctx) error {
	userID := c.Params("id")

	// TODO: SELECT * FROM user_platform_preferences WHERE user_id = $1
	return c.JSON(fiber.Map{
		"message": "Get platform preferences",
		"user_id": userID,
	})
}

func AddPlatformPreference(c *fiber.Ctx) error {
	userID := c.Params("id")

	// TODO: INSERT INTO user_platform_preferences
	return c.JSON(fiber.Map{
		"message": "Add platform preference",
		"user_id": userID,
	})
}

func UpdatePlatformPreference(c *fiber.Ctx) error {
	userID := c.Params("id")
	platformID := c.Params("platformId")

	// TODO: UPDATE user_platform_preferences
	return c.JSON(fiber.Map{
		"message":     "Update platform preference",
		"user_id":     userID,
		"platform_id": platformID,
	})
}

func DeletePlatformPreference(c *fiber.Ctx) error {
	userID := c.Params("id")
	platformID := c.Params("platformId")

	// TODO: DELETE FROM user_platform_preferences
	return c.JSON(fiber.Map{
		"message":     "Delete platform preference",
		"user_id":     userID,
		"platform_id": platformID,
	})
}
