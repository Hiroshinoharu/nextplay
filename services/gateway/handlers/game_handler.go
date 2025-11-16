package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/gateway/clients"
)

var gameClient = clients.NewGameClient()

func GetAllGames(c *fiber.Ctx) error {
	resp, err := gameClient.GetAllGames()
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

func GetGameByID(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := gameClient.GetGameByID(id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

func GetGameCompanies(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := gameClient.GetGameCompanies(id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

func GetGamePlatforms(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := gameClient.GetGamePlatforms(id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

func GetGameKeywords(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := gameClient.GetGameKeywords(id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}