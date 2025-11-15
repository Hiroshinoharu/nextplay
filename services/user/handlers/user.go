package handlers

import (
	"github.com/gofiber/fiber/v2"
)

func GetUserByID(c *fiber.Ctx) error {
	id := c.Params("id")

	// TODO: Query DB for user
	return c.JSON(fiber.Map{
		"message": "Get user",
		"user_id": id,
	})
}

func UpdateUser(c *fiber.Ctx) error {
	id := c.Params("id")

	// TODO: Read JSON → update DB
	return c.JSON(fiber.Map{
		"message": "Update user",
		"user_id": id,
	})
}

func DeleteUser(c *fiber.Ctx) error {
	id := c.Params("id")

	// TODO: Delete user from DB
	return c.JSON(fiber.Map{
		"message": "Delete user",
		"user_id": id,
	})
}
