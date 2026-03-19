package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestNewAuthRateLimiterRejectsRequestsOverLimit(t *testing.T) {
	t.Setenv("AUTH_RATE_LIMIT_MAX", "1")
	t.Setenv("AUTH_RATE_LIMIT_WINDOW_SECONDS", "60")

	app := fiber.New()
	app.Post("/users/login", NewAuthRateLimiter(), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	firstResp, err := app.Test(httptest.NewRequest("POST", "/users/login", nil))
	if err != nil {
		t.Fatalf("first app.Test returned error: %v", err)
	}
	defer firstResp.Body.Close()
	if firstResp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected first request to succeed with %d, got %d", fiber.StatusNoContent, firstResp.StatusCode)
	}

	secondResp, err := app.Test(httptest.NewRequest("POST", "/users/login", nil))
	if err != nil {
		t.Fatalf("second app.Test returned error: %v", err)
	}
	defer secondResp.Body.Close()
	if secondResp.StatusCode != fiber.StatusTooManyRequests {
		t.Fatalf("expected second request to fail with %d, got %d", fiber.StatusTooManyRequests, secondResp.StatusCode)
	}
}
