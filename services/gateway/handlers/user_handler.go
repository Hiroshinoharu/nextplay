package handlers

import (
	"github.com/maxceban/nextplay/services/gateway/clients"
	"github.com/gofiber/fiber/v2"
)

var userClient = clients.NewUserClient()

func GetUserByID(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := userClient.GetUserByID(id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

func CreateUser(c *fiber.Ctx) error {
	resp, err := userClient.CreateUser(c.Body())
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

func LoginUser(c *fiber.Ctx) error {
	resp, err := userClient.LoginUser(c.Body())
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

func GetUserPreferences(c *fiber.Ctx) error {
	id := c.Params("id")
	resp, err := userClient.GetUserPreferences(id)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

func GetUserInteraction(c *fiber.Ctx) error{
	id := c.Params("id")
	resp,err := userClient.GetUserInteraction(id)
	if err != nil{
		return c.Status(502).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}