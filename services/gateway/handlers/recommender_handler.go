package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/gateway/clients"
)

// Initialize recommender client
var recommenderClient = clients.NewRecommenderClient()

// mapUpstreamError maps errors from the Recommender Service to appropriate HTTP responses
func mapUpstreamError(c *fiber.Ctx, err error) error {
	upstreamErr, ok := err.(*clients.UpstreamError)
	if !ok {
		// Not an UpstreamError, return as internal server error
		return c.Status(500).JSON(fiber.Map{"error": "Internal server error"})
	}
	// Map specific status codes from the Recommender Service to appropriate HTTP responses
	switch upstreamErr.StatusCode {
	case 400:
		return c.Status(400).JSON(fiber.Map{"error": upstreamErr.Message})
	case 404:
		return c.Status(404).JSON(fiber.Map{"error": upstreamErr.Message})
	default:
		return c.Status(502).JSON(fiber.Map{"error": upstreamErr.Message})
	}
}

// POST /api/recommend
func RecommendFromFeatures(c *fiber.Ctx) error {
    var req map[string]interface{}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	result, err := recommenderClient.RecommendFromFeatures(req)
	if err != nil {
		return mapUpstreamError(c, err)
	}

	return c.Send(result) // return raw recommendation response
}

// GET /api/recommend/user/:id
func GetUserRecommendations(c *fiber.Ctx) error {
    userID := c.Params("id")

	result, err := recommenderClient.RecommendForUser(userID)
	if err != nil {
		return mapUpstreamError(c, err)
	}
    return c.Send(result) // return raw recommendation response
}

// GET /api/recommend/item/:id
func GetItemRecommendations(c *fiber.Ctx) error {
    itemID := c.Params("id")

    result, err := recommenderClient.RecommendForItem(itemID)
    if err != nil {
        return mapUpstreamError(c, err)
    }
    return c.Send(result)
}

// POST /api/recommend/item
func PostItemRecommendations(c *fiber.Ctx) error {
    result, err := recommenderClient.RecommendSimilar(c.Body())
    if err != nil {
        return mapUpstreamError(c, err)
    }
    return c.Send(result)
}
