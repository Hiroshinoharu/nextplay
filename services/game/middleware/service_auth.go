package middleware

import (
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// RequireServiceAuth enforces gateway-issued service-token auth for internal write routes.
func RequireServiceAuth(c *fiber.Ctx) error {
	expectedToken := strings.TrimSpace(os.Getenv("GATEWAY_SERVICE_TOKEN"))
	if expectedToken == "" {
		expectedToken = strings.TrimSpace(os.Getenv("SERVICE_TOKEN"))
	}
	if expectedToken == "" {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "service auth not configured"})
	}

	providedToken := strings.TrimSpace(c.Get("X-Service-Token"))
	if providedToken == "" || providedToken != expectedToken {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized service token"})
	}

	return c.Next()
}
