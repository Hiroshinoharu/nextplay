package middleware

import (
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

const (
	defaultAuthRateLimitMax             = 10
	defaultAuthRateLimitWindowInSeconds = 60
)

// NewAuthRateLimiter returns a per-route rate limiter for auth-sensitive endpoints.
func NewAuthRateLimiter() fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        authRateLimitMax(),
		Expiration: authRateLimitWindow(),
		KeyGenerator: func(c *fiber.Ctx) string {
			routePath := c.Path()
			if route := c.Route(); route != nil && strings.TrimSpace(route.Path) != "" {
				routePath = route.Path
			}
			forwardedFor := strings.TrimSpace(c.Get("X-Forwarded-For"))
			if forwardedFor != "" {
				return forwardedFor + ":" + routePath
			}
			return c.IP() + ":" + routePath
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "too many requests",
			})
		},
	})
}

func authRateLimitMax() int {
	if raw := strings.TrimSpace(os.Getenv("AUTH_RATE_LIMIT_MAX")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			return parsed
		}
	}
	return defaultAuthRateLimitMax
}

func authRateLimitWindow() time.Duration {
	if raw := strings.TrimSpace(os.Getenv("AUTH_RATE_LIMIT_WINDOW_SECONDS")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			return time.Duration(parsed) * time.Second
		}
	}
	return defaultAuthRateLimitWindowInSeconds * time.Second
}
