package handlers

import (
	"gateway/clients"
	"github.com/gofiber/fiber/v2"
)

func GetRecommendations(c *fiber.Ctx) error {
	resp, err := clients.RecommenderPost("/recommend", c.Body())
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

func GetUserRecommendations(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := clients.RecommenderGet("/recommend/user/" + id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}