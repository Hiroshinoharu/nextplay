package handlers

import "github.com/gofiber/fiber/v2"

func GetKeywordPrefernces(c *fiber.Ctx) error{
	return c.JSON(fiber.Map{"msg": "get user keyword prefs"})
}

func GetPlatformPreferences(c *fiber.Ctx) error {
    return c.JSON(fiber.Map{"msg": "get user platform prefs"})
}