package handlers

import (
	"database/sql"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/user/db"
	"github.com/maxceban/nextplay/services/user/models"
)

// Register handles POST /auth/register requests
func Register(c *fiber.Ctx) error {
	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	// Parse and validate input
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}

	// Trim spaces and validate fields
	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(req.Email)
	req.Password = strings.TrimSpace(req.Password)
	if req.Username == "" || req.Email == "" || req.Password == "" || !strings.Contains(req.Email, "@") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid input"})
	}

	// Check database connection
	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	// Insert new user into the database
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

	// Create user object to return
	user := models.User{
		ID:          id,
		Username:    req.Username,
		Email:       req.Email,
		SteamLinked: steamLinked,
	}
	// Return the created user
	return c.Status(fiber.StatusCreated).JSON(user)
}

// Login handles POST /auth/login requests
func Login(c *fiber.Ctx) error {
	// Parse and validate input
	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	
	// Parse and validate input
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}

	// Trim spaces and validate fields
	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(req.Email)
	req.Password = strings.TrimSpace(req.Password)
	if req.Password == "" || (req.Username == "" && req.Email == "") || (req.Email != "" && !strings.Contains(req.Email, "@")) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid input"})
	}

	// Check database connection
	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	// Authenticate user
	var user models.User
	var err error
	// Authenticate user
	if req.Username != "" {
		err = db.DB.QueryRow(
			"SELECT user_id, username, email, steam_linked FROM app_user WHERE username = $1 AND password = $2",
			req.Username,
			req.Password,
		).Scan(&user.ID, &user.Username, &user.Email, &user.SteamLinked)
	} else {
		// Authenticate using email
		err = db.DB.QueryRow(
			"SELECT user_id, username, email, steam_linked FROM app_user WHERE email = $1 AND password = $2",
			req.Email,
			req.Password,
		).Scan(&user.ID, &user.Username, &user.Email, &user.SteamLinked)
	}
	// Handle authentication result
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid credentials"})
	}
	// Handle authentication result
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to authenticate user"})
	}

	// Return authenticated user
	return c.JSON(user)
}
