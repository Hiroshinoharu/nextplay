package handlers

import "github.com/gofiber/fiber/v2"

func GetInteractions(c *fiber.Ctx) error {
    return c.JSON(fiber.Map{"msg": "get interactions"})
}

func CreateOrUpdateInteraction(c *fiber.Ctx) error {
    return c.JSON(fiber.Map{"msg": "create/update interaction"})
}