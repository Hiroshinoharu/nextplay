package middleware

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/gateway/auth"
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

	// Store the user ID in the context for downstream handlers
	c.Locals("user_id", claims.Subject)
	return c.Next()
}

// RequireSameUserParam ensures the path parameter matches the authenticated user.
func RequireSameUserParam(paramName string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		rawUserID := strings.TrimSpace(c.Params(paramName))
		if rawUserID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing user id"})
		}

		subject, ok := c.Locals("user_id").(string)
		if !ok || strings.TrimSpace(subject) == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "missing or invalid token"})
		}

		// Validate param format so malformed IDs are rejected consistently.
		if _, err := strconv.ParseInt(rawUserID, 10, 64); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid user id"})
		}

		if rawUserID != subject {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
		}

		return c.Next()
	}
}
