package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/gateway/clients"
)

// Initialize recommender client
var recommenderClient = clients.NewRecommenderClient()

// POST /api/recommend
func RecommendFromFeatures(c *fiber.Ctx) error {
	var req map[string]interface{}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	result, err := recommenderClient.RecommendFromFeatures(req)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Send(result) // return raw recommendation response
}

// GET /api/recommend/user/:id
func GetUserRecommendations(c *fiber.Ctx) error {
	userID := c.Params("id")

	result, err := recommenderClient.RecommendForUser(userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Send(result) // return raw recommendation response
}
