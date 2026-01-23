package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/user/auth"
)

// RequireJWT is a middleware that enforces JWT authentication
func RequireJWT(c *fiber.Ctx) error {
	
	// Extract the token from the Authorization header
	authHeader := strings.TrimSpace(c.Get("Authorization"))
	
	// Check if the token is present and properly formatted
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "missing or invalid token"})
	}

	// Parse and validate the token
	tokenStr := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	
	// Parse the token to extract claims
	claims, err := auth.ParseToken(tokenStr)
	if err != nil || claims.Subject == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "missing or invalid token"})
	}

	// Optional: Check if the user ID in the URL matches the token's subject
	if id := c.Params("id"); id != "" && id != claims.Subject {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
	}

	// Store the user ID in the context for downstream handlers
	c.Locals("user_id", claims.Subject)
	return c.Next()
}
