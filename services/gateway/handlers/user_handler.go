package handlers

import (
	"github.com/maxceban/nextplay/services/gateway/clients"
	"github.com/gofiber/fiber/v2"
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

// CreateUser handles POST /api/users
func CreateUser(c *fiber.Ctx) error {
	resp, err := userClient.CreateUser(c.Body())
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

// GetUserPreferences handles GET /api/users/:id/preferences
func GetUserPreferences(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := userClient.GetUserPreferences(id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

// GetUserInteraction handles GET /api/users/:id/interactions
func GetUserInteraction(c *fiber.Ctx) error{
	id := c.Params("id")
	resp,err := userClient.GetUserInteraction(id)
	if err != nil{
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

// CreateUserPreference handles POST /api/users/:id/preferences
func CreateUserPreference(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := userClient.CreateUserPreference(id, c.Body())
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