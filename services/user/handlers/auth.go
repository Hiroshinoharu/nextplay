package handlers

import (
	"database/sql"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/user/auth"
	"github.com/maxceban/nextplay/services/user/db"
)

// lookupExistingAuthIdentity checks if a user with the given username or email already exists.
// It returns two booleans indicating whether the username or email already exists, and an error if one occurs.
// If the database connection is not initialized, it returns false, false, and sql.ErrConnDone.
func lookupExistingAuthIdentity(username string, email string) (bool, bool, error) {
	if db.DB == nil {
		return false, false, sql.ErrConnDone
	}

	normalizedUsername := strings.TrimSpace(username)
	normalizedEmail := strings.TrimSpace(email)

	var usernameExists bool
	var emailExists bool

	if normalizedUsername != "" {
		err := db.DB.QueryRow(
			"SELECT EXISTS(SELECT 1 FROM app_user WHERE LOWER(username) = LOWER($1))",
			normalizedUsername,
		).Scan(&usernameExists)
		if err != nil {
			return false, false, err
		}
	}

	if normalizedEmail != "" {
		err := db.DB.QueryRow(
			"SELECT EXISTS(SELECT 1 FROM app_user WHERE LOWER(email) = LOWER($1))",
			normalizedEmail,
		).Scan(&emailExists)
		if err != nil {
			return false, false, err
		}
	}

	return usernameExists, emailExists, nil
}

// CheckAvailability handles GET /users/availability requests.
func CheckAvailability(c *fiber.Ctx) error {
	username := strings.TrimSpace(c.Query("username"))
	email := strings.TrimSpace(c.Query("email"))

	if username == "" && email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "username or email is required"})
	}
	if email != "" && !strings.Contains(email, "@") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid email"})
	}
	if !authStoreReady() {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	usernameExists, emailExists, err := lookupAuthIdentity(username, email)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to check availability"})
	}

	return c.JSON(fiber.Map{
		"username": fiber.Map{
			"value":  username,
			"exists": usernameExists,
		},
		"email": fiber.Map{
			"value":  email,
			"exists": emailExists,
		},
	})
}

// Register handles POST /auth/register requests
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
	if err := auth.ValidatePasswordPolicy(req.Password); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if !authStoreReady() {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	usernameExists, emailExists, err := lookupAuthIdentity(req.Username, req.Email)
	if err != nil && err != sql.ErrConnDone {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to validate user identity"})
	}
	if usernameExists {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "username already exists"})
	}
	if emailExists {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "email already exists"})
	}

	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to secure password"})
	}

	user, err := createAuthUser(req.Username, hashedPassword, req.Email)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create user"})
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
	if !authStoreReady() {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	user, storedPassword, err := getAuthUserByEmail(req.Email)
	if req.Username != "" {
		user, storedPassword, err = getAuthUserByUsername(req.Username)
	}
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid credentials"})
	}
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
			_ = upgradeAuthPasswordHash(user.ID, newHash)
		}
	}

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

// ChangePassword handles PATCH /users/:id/password requests.
func ChangePassword(c *fiber.Ctx) error {
	id := strings.TrimSpace(c.Params("id"))

	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}

	req.CurrentPassword = strings.TrimSpace(req.CurrentPassword)
	req.NewPassword = strings.TrimSpace(req.NewPassword)
	if req.CurrentPassword == "" || req.NewPassword == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "current_password and new_password are required"})
	}
	if req.CurrentPassword == req.NewPassword {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "new password must be different from current password"})
	}
	if err := auth.ValidatePasswordPolicy(req.NewPassword); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if !authStoreReady() {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "database not initialized"})
	}

	storedPassword, err := getAuthPasswordHashByUserID(id)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "user not found"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to look up user"})
	}

	ok, _, err := auth.VerifyPassword(req.CurrentPassword, storedPassword)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to authenticate user"})
	}
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "current password is incorrect"})
	}

	hashedPassword, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to secure password"})
	}

	rowsAffected, err := saveAuthPasswordHash(id, hashedPassword)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update password"})
	}
	if rowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "user not found"})
	}

	return c.JSON(fiber.Map{"message": "Password updated successfully"})
}
