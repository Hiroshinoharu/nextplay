package observability

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

const HeaderRequestID = "X-Request-ID"

const requestIDLocalKey = "request_id"

// requestIDFromHeader returns the request ID from the X-Request-ID header, or an empty string if it is not present.
func requestIDFromHeader(c *fiber.Ctx) string {
	return strings.TrimSpace(c.Get(HeaderRequestID))
}

// generateRequestID generates a unique request ID using a secure random number generator.
// If the generator fails for any reason, it returns a timestamp in the format "20060102150405.000000000".
// This function is used to generate request IDs for fibers that do not have one set.
func generateRequestID() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return time.Now().UTC().Format("20060102150405.000000000")
	}
	return hex.EncodeToString(buf)
}

// RequestID returns the request ID stored on fiber locals.
func RequestID(c *fiber.Ctx) string {
	if raw := c.Locals(requestIDLocalKey); raw != nil {
		if rid, ok := raw.(string); ok && strings.TrimSpace(rid) != "" {
			return rid
		}
	}
	rid := requestIDFromHeader(c)
	if rid == "" {
		rid = generateRequestID()
	}
	return rid
}

// AccessLog adds request ID handling and consistent access logs.
func AccessLog(serviceName string) fiber.Handler {
	name := strings.TrimSpace(serviceName)
	if name == "" {
		name = "unknown"
	}

	return func(c *fiber.Ctx) error {
		rid := requestIDFromHeader(c)
		if rid == "" {
			rid = generateRequestID()
		}

		c.Locals(requestIDLocalKey, rid)
		c.Set(HeaderRequestID, rid)

		start := time.Now()
		err := c.Next()
		latencyMs := float64(time.Since(start).Microseconds()) / 1000.0

		status := c.Response().StatusCode()
		if status == 0 {
			status = fiber.StatusOK
		}

		log.Printf(
			"service=%s request_id=%s method=%s path=%s status=%d latency_ms=%.2f ip=%s ua=%q",
			name,
			rid,
			c.Method(),
			c.OriginalURL(),
			status,
			latencyMs,
			c.IP(),
			c.Get("User-Agent"),
		)

		return err
	}
}
