package handlers

import (
	"database/sql"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/user/auth"
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
	if err := auth.ValidatePasswordPolicy(req.Password); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	// Check database connection
	if db.DB == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to secure password"})
	}

	// Insert new user into the database
	var id int64
	var steamLinked bool
	err = db.DB.QueryRow(
		"INSERT INTO app_user (username, password, email) VALUES ($1, $2, $3) RETURNING user_id, steam_linked",
		req.Username,
		hashedPassword,
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
	token, err := auth.CreateToken(user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create token"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":           user.ID,
		"username":     user.Username,
		"email":        user.Email,
		"steam_linked": user.SteamLinked,
		"token":        token,
	})
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
	var storedPassword string
	var err error
	// Authenticate user
	if req.Username != "" {
		err = db.DB.QueryRow(
			"SELECT user_id, username, email, password, steam_linked FROM app_user WHERE username = $1",
			req.Username,
		).Scan(&user.ID, &user.Username, &user.Email, &storedPassword, &user.SteamLinked)
	} else {
		// Authenticate using email
		err = db.DB.QueryRow(
			"SELECT user_id, username, email, password, steam_linked FROM app_user WHERE email = $1",
			req.Email,
		).Scan(&user.ID, &user.Username, &user.Email, &storedPassword, &user.SteamLinked)
	}
	// Handle authentication result
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid credentials"})
	}
	// Handle authentication result
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to authenticate user"})
	}

	ok, needsUpgrade, err := auth.VerifyPassword(req.Password, storedPassword)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to authenticate user"})
	}
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid credentials"})
	}

	if needsUpgrade {
		if newHash, err := auth.HashPassword(req.Password); err == nil {
			_, _ = db.DB.Exec("UPDATE app_user SET password = $1 WHERE user_id = $2", newHash, user.ID)
		}
	}

	// Return authenticated user
	token, err := auth.CreateToken(user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create token"})
	}

	return c.JSON(fiber.Map{
		"id":           user.ID,
		"username":     user.Username,
		"email":        user.Email,
		"steam_linked": user.SteamLinked,
		"token":        token,
	})
}
