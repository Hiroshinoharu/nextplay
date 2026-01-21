package handlers

import (
	"database/sql"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/user/db"
	"github.com/maxceban/nextplay/services/user/models"
)

func Register(c *fiber.Ctx) error {
	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(req.Email)
	req.Password = strings.TrimSpace(req.Password)
	if req.Username == "" || req.Email == "" || req.Password == "" || !strings.Contains(req.Email, "@") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid input"})
	}

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	var id int64
	var steamLinked bool
	err := db.DB.QueryRow(
		"INSERT INTO app_user (username, password, email) VALUES ($1, $2, $3) RETURNING user_id, steam_linked",
		req.Username,
		req.Password,
		req.Email,
	).Scan(&id, &steamLinked)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create user"})
	}

	user := models.User{
		ID:          id,
		Username:    req.Username,
		Email:       req.Email,
		SteamLinked: steamLinked,
	}
	return c.Status(fiber.StatusCreated).JSON(user)
}

func Login(c *fiber.Ctx) error {
	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(req.Email)
	req.Password = strings.TrimSpace(req.Password)
	if req.Password == "" || (req.Username == "" && req.Email == "") || (req.Email != "" && !strings.Contains(req.Email, "@")) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid input"})
	}

	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	var user models.User
	var err error
	if req.Username != "" {
		err = db.DB.QueryRow(
			"SELECT user_id, username, email, steam_linked FROM app_user WHERE username = $1 AND password = $2",
			req.Username,
			req.Password,
		).Scan(&user.ID, &user.Username, &user.Email, &user.SteamLinked)
	} else {
		err = db.DB.QueryRow(
			"SELECT user_id, username, email, steam_linked FROM app_user WHERE email = $1 AND password = $2",
			req.Email,
			req.Password,
		).Scan(&user.ID, &user.Username, &user.Email, &user.SteamLinked)
	}
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid credentials"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to authenticate user"})
	}

	return c.JSON(user)
}
