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

func TestNewAuthRateLimiterIgnoresSpoofedForwardedForByDefault(t *testing.T) {
	t.Setenv("AUTH_RATE_LIMIT_MAX", "1")
	t.Setenv("AUTH_RATE_LIMIT_WINDOW_SECONDS", "60")
	t.Setenv("TRUST_PROXY_HEADERS", "false")

	app := fiber.New()
	app.Post("/users/login", NewAuthRateLimiter(), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	firstReq := httptest.NewRequest("POST", "/users/login", nil)
	firstReq.RemoteAddr = "203.0.113.10:1234"
	firstReq.Header.Set("X-Forwarded-For", "198.51.100.10")
	firstResp, err := app.Test(firstReq)
	if err != nil {
		t.Fatalf("first app.Test returned error: %v", err)
	}
	defer firstResp.Body.Close()
	if firstResp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected first request to succeed with %d, got %d", fiber.StatusNoContent, firstResp.StatusCode)
	}

	secondReq := httptest.NewRequest("POST", "/users/login", nil)
	secondReq.RemoteAddr = "203.0.113.10:1234"
	secondReq.Header.Set("X-Forwarded-For", "198.51.100.11")
	secondResp, err := app.Test(secondReq)
	if err != nil {
		t.Fatalf("second app.Test returned error: %v", err)
	}
	defer secondResp.Body.Close()
	if secondResp.StatusCode != fiber.StatusTooManyRequests {
		t.Fatalf("expected spoofed forwarded header to be ignored and request to fail with %d, got %d", fiber.StatusTooManyRequests, secondResp.StatusCode)
	}
}

func TestNewAuthRateLimiterUsesForwardedForWhenExplicitlyTrusted(t *testing.T) {
	t.Setenv("AUTH_RATE_LIMIT_MAX", "1")
	t.Setenv("AUTH_RATE_LIMIT_WINDOW_SECONDS", "60")
	t.Setenv("TRUST_PROXY_HEADERS", "true")

	app := fiber.New()
	app.Post("/users/login", NewAuthRateLimiter(), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	firstReq := httptest.NewRequest("POST", "/users/login", nil)
	firstReq.RemoteAddr = "203.0.113.10:1234"
	firstReq.Header.Set("X-Forwarded-For", "198.51.100.10")
	firstResp, err := app.Test(firstReq)
	if err != nil {
		t.Fatalf("first app.Test returned error: %v", err)
	}
	defer firstResp.Body.Close()
	if firstResp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected first request to succeed with %d, got %d", fiber.StatusNoContent, firstResp.StatusCode)
	}

	secondReq := httptest.NewRequest("POST", "/users/login", nil)
	secondReq.RemoteAddr = "203.0.113.10:1234"
	secondReq.Header.Set("X-Forwarded-For", "198.51.100.11")
	secondResp, err := app.Test(secondReq)
	if err != nil {
		t.Fatalf("second app.Test returned error: %v", err)
	}
	defer secondResp.Body.Close()
	if secondResp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected trusted forwarded header to use a different budget and succeed with %d, got %d", fiber.StatusNoContent, secondResp.StatusCode)
	}
}
