package middleware

import "github.com/gofiber/fiber/v2"

// SecurityHeaders applies baseline API hardening headers.
func SecurityHeaders(c *fiber.Ctx) error {
	c.Set("X-Content-Type-Options", "nosniff")
	c.Set("X-Frame-Options", "DENY")
	c.Set("Referrer-Policy", "strict-origin-when-cross-origin")
	c.Set("Permissions-Policy", "camera=(), geolocation=(), microphone=()")
	return c.Next()
}
