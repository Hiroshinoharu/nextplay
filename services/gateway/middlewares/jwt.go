package middleware

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	gatewayauth "github.com/maxceban/nextplay/services/gateway/auth"
)

// RequireJWT is a middleware that enforces JWT authentication.
func RequireJWT(c *fiber.Ctx) error {
	authHeader := gatewayauth.AuthorizationHeaderValue(
		c.Get("Authorization"),
		c.Cookies(gatewayauth.SessionCookieName()),
	)
	if authHeader == "" {
		return rejectInvalidSession(c)
	}

	tokenStr := gatewayauth.ExtractToken(
		c.Get("Authorization"),
		c.Cookies(gatewayauth.SessionCookieName()),
	)
	claims, err := gatewayauth.ParseToken(tokenStr)
	if err != nil || claims.Subject == "" {
		return rejectInvalidSession(c)
	}

	c.Locals("user_id", claims.Subject)
	c.Locals("auth_header", authHeader)
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
			return rejectInvalidSession(c)
		}

		if _, err := strconv.ParseInt(rawUserID, 10, 64); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid user id"})
		}

		if rawUserID != subject {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
		}

		return c.Next()
	}
}

func rejectInvalidSession(c *fiber.Ctx) error {
	c.Set("X-NextPlay-Auth-Error", "session-invalid")
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "missing or invalid token"})
}
