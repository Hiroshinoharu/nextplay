package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// TestNewAuthRateLimiterRejectsRequestsOverLimit tests that a rate limiter set with a limit of 1 request per minute rejects the second request within the same minute window.
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

// TestNewAvailabilityRateLimiterUsesSeparateBudget tests that a rate limiter set with different limits and window sizes for auth and availability endpoints does not share the same budget.
func TestNewAvailabilityRateLimiterUsesSeparateBudget(t *testing.T) {
	t.Setenv("AUTH_RATE_LIMIT_MAX", "1")
	t.Setenv("AUTH_RATE_LIMIT_WINDOW_SECONDS", "60")
	t.Setenv("AUTH_AVAILABILITY_RATE_LIMIT_MAX", "2")
	t.Setenv("AUTH_AVAILABILITY_RATE_LIMIT_WINDOW_SECONDS", "60")

	app := fiber.New()
	app.Get("/users/availability", NewAvailabilityRateLimiter(), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	for i := 0; i < 2; i++ {
		resp, err := app.Test(httptest.NewRequest("GET", "/users/availability", nil))
		if err != nil {
			t.Fatalf("availability request %d returned error: %v", i+1, err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != fiber.StatusNoContent {
			t.Fatalf("expected availability request %d to succeed with %d, got %d", i+1, fiber.StatusNoContent, resp.StatusCode)
		}
	}

	resp, err := app.Test(httptest.NewRequest("GET", "/users/availability", nil))
	if err != nil {
		t.Fatalf("third availability request returned error: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != fiber.StatusTooManyRequests {
		t.Fatalf("expected third availability request to fail with %d, got %d", fiber.StatusTooManyRequests, resp.StatusCode)
	}
}
