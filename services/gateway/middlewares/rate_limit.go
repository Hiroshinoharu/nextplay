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
	defaultAuthRateLimitMax                     = 10
	defaultAuthRateLimitWindowInSeconds         = 60
	defaultAvailabilityRateLimitMax             = 30
	defaultAvailabilityRateLimitWindowInSeconds = 60
)

type rateLimitSettings struct {
	maxEnvVar              string
	defaultMax             int
	windowEnvVar           string
	defaultWindowInSeconds int
}

// NewAuthRateLimiter returns a per-route rate limiter for auth-sensitive endpoints.
func NewAuthRateLimiter() fiber.Handler {
	return newRateLimiter(rateLimitSettings{
		maxEnvVar:              "AUTH_RATE_LIMIT_MAX",
		defaultMax:             defaultAuthRateLimitMax,
		windowEnvVar:           "AUTH_RATE_LIMIT_WINDOW_SECONDS",
		defaultWindowInSeconds: defaultAuthRateLimitWindowInSeconds,
	})
}

// NewAvailabilityRateLimiter allows more headroom for debounced signup availability checks.
func NewAvailabilityRateLimiter() fiber.Handler {
	return newRateLimiter(rateLimitSettings{
		maxEnvVar:              "AUTH_AVAILABILITY_RATE_LIMIT_MAX",
		defaultMax:             defaultAvailabilityRateLimitMax,
		windowEnvVar:           "AUTH_AVAILABILITY_RATE_LIMIT_WINDOW_SECONDS",
		defaultWindowInSeconds: defaultAvailabilityRateLimitWindowInSeconds,
	})
}

// newRateLimiter returns a rate limiter that enforces per-route rate limits on incoming requests.
// The rate limiter is configured with the following settings:
// - Max: the maximum number of requests allowed within the expiration window.
//   This value is read from the environment variable specified in settings.maxEnvVar.
//   If the value is not set or is not a positive integer, the default value specified in settings.defaultMax is used.
// - Expiration: the time duration of the rate limit window.
//   This value is read from the environment variable specified in settings.windowEnvVar.
//   If the value is not set or is not a positive integer, the default value specified in settings.defaultWindowInSeconds is used.
// - KeyGenerator: a function that generates a unique key for each request based on the client's IP address and the route path.
// - LimitReached: a function that is called when the rate limit is reached.
//   This function should return an error that will be returned to the client when the rate limit is reached.
func newRateLimiter(settings rateLimitSettings) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        positiveIntFromEnv(settings.maxEnvVar, settings.defaultMax),
		Expiration: time.Duration(positiveIntFromEnv(settings.windowEnvVar, settings.defaultWindowInSeconds)) * time.Second,
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

// positiveIntFromEnv returns a positive integer value from an environment variable, or the given fallback value if the environment variable is not set or does not contain a valid positive integer.
func positiveIntFromEnv(name string, fallback int) int {
	if raw := strings.TrimSpace(os.Getenv(name)); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			return parsed
		}
	}
	return fallback
}
