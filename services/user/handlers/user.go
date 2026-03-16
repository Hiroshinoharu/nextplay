package handlers

import (
	"database/sql"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/user/db"
	"github.com/maxceban/nextplay/services/user/models"
)

// GetUserByID handles GET /users/:id requests
func GetUserByID(c *fiber.Ctx) error {
	// Retrieve the user ID from the URL parameters
	id := c.Params("id")

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	// Declare a user variable to hold the fetched data
	var user models.User
	err := db.DB.QueryRow(
		"SELECT user_id, username, email, steam_linked FROM app_user WHERE user_id = $1",
		id,
	).Scan(&user.ID, &user.Username, &user.Email, &user.SteamLinked)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "user not found"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch user"})
	}

	return c.JSON(user)
}

func UpdateUser(c *fiber.Ctx) error {
	id := c.Params("id")

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	var req struct {
		Username    *string `json:"username"`
		Email       *string `json:"email"`
		SteamLinked *bool   `json:"steam_linked"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}
	if req.Username == nil && req.Email == nil && req.SteamLinked == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "no fields to update"})
	}

	var user models.User
	err := db.DB.QueryRow(
		`UPDATE app_user
		 SET username = COALESCE($1, username),
		     email = COALESCE($2, email),
		     steam_linked = COALESCE($3, steam_linked)
		 WHERE user_id = $4
		 RETURNING user_id, username, email, steam_linked`,
		req.Username,
		req.Email,
		req.SteamLinked,
		id,
	).Scan(&user.ID, &user.Username, &user.Email, &user.SteamLinked)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "user not found"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update user"})
	}

	return c.JSON(user)
}

// DeleteUser handles DELETE /users/:id requests
func DeleteUser(c *fiber.Ctx) error {
	id := c.Params("id")

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	var deletedID int64
	err := db.DB.QueryRow(
		`WITH deleted_interactions AS (
			DELETE FROM user_interactions WHERE user_id = $1
		),
		deleted_events AS (
			DELETE FROM recommendation_events WHERE user_id = $1
		),
		deleted_user AS (
			DELETE FROM app_user WHERE user_id = $1
			RETURNING user_id
		)
		SELECT user_id FROM deleted_user`,
		id,
	).Scan(&deletedID)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "user not found"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete user"})
	}
	return c.JSON(fiber.Map{
		"message": "Delete user",
		"user_id": id,
	})
}
