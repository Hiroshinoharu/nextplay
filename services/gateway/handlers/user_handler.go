package handlers

import (
	"gateway/clients"
	"github.com/gofiber/fiber/v2"
)

func GetUserByID(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := clients.UserServiceGet("/users/" + id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

func CreateUser(c *fiber.Ctx) error {
	resp, err := clients.UserServicePost("/users", c.Body())
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}
