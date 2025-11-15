package handlers

import (
	"github.com/gofiber/fiber/v2"
)

func Register(c *fiber.Ctx) error {
	// TODO: Read JSON → validate → insert → return new user
	return c.JSON(fiber.Map{
		"message": "Register endpoint hit",
	})
}

func Login(c *fiber.Ctx) error {
	// TODO: Validate credentials → return JWT later
	return c.JSON(fiber.Map{
		"message": "Login endpoint hit",
	})
}
