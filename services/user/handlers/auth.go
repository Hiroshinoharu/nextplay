package handlers

import (
	"github.com/gofiber/fiber/v2"
)

func Register(c *fiber.Ctx) error{
	return c.JSON(fiber.Map{
		"msg": "register user (not implmented yet)",
	})
}

func Login(c *fiber.Ctx) error{
	return c.JSON(fiber.Map{
		"msg": "login endpoint (not implemented)",
	})
}