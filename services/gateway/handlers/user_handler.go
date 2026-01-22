package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/gateway/clients"
)

// Initialize user client
var userClient = clients.NewUserClient()

// GetUserByID handles GET /api/users/:id
func GetUserByID(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := userClient.GetUserByID(id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

// RegisterUser handles POST /api/users/register
func RegisterUser(c *fiber.Ctx) error {
	resp, err := userClient.RegisterUser(c.Body())
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

// LoginUser handles POST /api/users/login
func LoginUser(c *fiber.Ctx) error {
	resp, err := userClient.LoginUser(c.Body())
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

// UpdateUser handles PUT /api/users/:id
func UpdateUser(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := userClient.UpdateUser(id, c.Body())
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

// DeleteUser handles DELETE /api/users/:id
func DeleteUser(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := userClient.DeleteUser(id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

// GetUserInteraction handles GET /api/users/:id/interactions
func GetUserInteraction(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := userClient.GetUserInteraction(id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

// CreateUserInteraction handles POST /api/users/:id/interactions
func CreateUserInteraction(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := userClient.CreateUserInteraction(id, c.Body())
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

// DeleteUserInteraction handles DELETE /api/users/:id/interactions/:gameId
func DeleteUserInteraction(c *fiber.Ctx) error {
	id := c.Params("id")
	gameID := c.Params("gameId")
	resp, err := userClient.DeleteUserInteraction(id, gameID)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

// GetUserKeywordPreferences handles GET /api/users/:id/keywords
func GetUserKeywordPreferences(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := userClient.GetUserKeywordPreferences(id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

// CreateUserKeywordPreference handles POST /api/users/:id/keywords
func CreateUserKeywordPreference(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := userClient.CreateUserKeywordPreference(id, c.Body())
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

// UpdateUserKeywordPreference handles PUT /api/users/:id/keywords/:keywordId
func UpdateUserKeywordPreference(c *fiber.Ctx) error {
	id := c.Params("id")
	keywordID := c.Params("keywordId")
	resp, err := userClient.UpdateUserKeywordPreference(id, keywordID, c.Body())
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

// DeleteUserKeywordPreference handles DELETE /api/users/:id/keywords/:keywordId
func DeleteUserKeywordPreference(c *fiber.Ctx) error {
	id := c.Params("id")
	keywordID := c.Params("keywordId")
	resp, err := userClient.DeleteUserKeywordPreference(id, keywordID)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

// GetUserPlatformPreferences handles GET /api/users/:id/platforms
func GetUserPlatformPreferences(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := userClient.GetUserPlatformPreferences(id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

// CreateUserPlatformPreference handles POST /api/users/:id/platforms
func CreateUserPlatformPreference(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := userClient.CreateUserPlatformPreference(id, c.Body())
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

// UpdateUserPlatformPreference handles PUT /api/users/:id/platforms/:platformId
func UpdateUserPlatformPreference(c *fiber.Ctx) error {
	id := c.Params("id")
	platformID := c.Params("platformId")
	resp, err := userClient.UpdateUserPlatformPreference(id, platformID, c.Body())
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

// DeleteUserPlatformPreference handles DELETE /api/users/:id/platforms/:platformId
func DeleteUserPlatformPreference(c *fiber.Ctx) error {
	id := c.Params("id")
	platformID := c.Params("platformId")
	resp, err := userClient.DeleteUserPlatformPreference(id, platformID)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}
