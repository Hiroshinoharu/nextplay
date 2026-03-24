package middleware

import (
	"crypto/subtle"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// RequireServiceAuth enforces service-to-service auth for internal operation routes.
func RequireServiceAuth(c *fiber.Ctx) error {
	expectedToken := strings.TrimSpace(os.Getenv("GATEWAY_SERVICE_TOKEN"))
	if expectedToken == "" {
		expectedToken = strings.TrimSpace(os.Getenv("SERVICE_TOKEN"))
	}
	if expectedToken == "" {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "service auth not configured"})
	}

	providedToken := strings.TrimSpace(c.Get("X-Service-Token"))
	if providedToken == "" || subtle.ConstantTimeCompare([]byte(providedToken), []byte(expectedToken)) != 1 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized service token"})
	}

	return c.Next()
}
