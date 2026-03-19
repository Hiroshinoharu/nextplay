package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	gatewayauth "github.com/maxceban/nextplay/services/gateway/auth"
)

// RequireCSRF protects unsafe browser requests that rely on the session cookie.
func RequireCSRF(c *fiber.Ctx) error {
	sessionToken := strings.TrimSpace(c.Cookies(gatewayauth.SessionCookieName()))
	if sessionToken == "" {
		return c.Next()
	}

	if _, err := gatewayauth.EnsureCSRFCookie(c); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to generate csrf token",
		})
	}

	if isCSRFSafeMethod(c.Method()) || hasBearerAuthorization(c) {
		return c.Next()
	}

	if gatewayauth.ValidateCSRFToken(
		c.Cookies(gatewayauth.CSRFCookieName()),
		c.Get(gatewayauth.CSRFHeaderName()),
	) {
		return c.Next()
	}

	return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
		"error": "missing or invalid csrf token",
	})
}

func hasBearerAuthorization(c *fiber.Ctx) bool {
	authHeader := strings.TrimSpace(c.Get("Authorization"))
	if len(authHeader) < 7 || !strings.EqualFold(authHeader[:7], "Bearer ") {
		return false
	}
	return strings.TrimSpace(authHeader[7:]) != ""
}

func isCSRFSafeMethod(method string) bool {
	switch strings.ToUpper(strings.TrimSpace(method)) {
	case fiber.MethodGet, fiber.MethodHead, fiber.MethodOptions:
		return true
	default:
		return false
	}
}
