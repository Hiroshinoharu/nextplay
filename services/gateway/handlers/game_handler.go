package handlers

import (
	"gateway/clients"
	"github.com/gofiber/fiber/v2"
)

func GetAllGames(c *fiber.Ctx) error {
	resp, err := clients.GameServiceGet("/games")
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

func GetGameByID(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := clients.GameServiceGet("/games/" + id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}
