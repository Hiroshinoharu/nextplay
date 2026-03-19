package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// TestRequireServiceAuthReturnsServerErrorWhenNotConfigured tests that the RequireServiceAuth middleware
// returns a 500 Internal Server Error when the GATEWAY_SERVICE_TOKEN or SERVICE_TOKEN environment
// variable is not set.
func TestRequireServiceAuthReturnsServerErrorWhenNotConfigured(t *testing.T) {
	t.Setenv("GATEWAY_SERVICE_TOKEN", "")
	t.Setenv("SERVICE_TOKEN", "")

	app := fiber.New()
	app.Get("/internal", RequireServiceAuth, func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	resp, err := app.Test(httptest.NewRequest("GET", "/internal", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusInternalServerError {
		t.Fatalf("expected status %d, got %d", fiber.StatusInternalServerError, resp.StatusCode)
	}
}

// TestRequireServiceAuthRejectsWrongToken tests that the RequireServiceAuth middleware
// returns a 401 Unauthorized response when the provided service token does not match the
// expected token.
func TestRequireServiceAuthRejectsWrongToken(t *testing.T) {
	t.Setenv("GATEWAY_SERVICE_TOKEN", "expected-token")

	app := fiber.New()
	app.Get("/internal", RequireServiceAuth, func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	req := httptest.NewRequest("GET", "/internal", nil)
	req.Header.Set("X-Service-Token", "wrong-token")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", fiber.StatusUnauthorized, resp.StatusCode)
	}
}

// TestRequireServiceAuthAcceptsMatchingToken tests that the RequireServiceAuth middleware
// returns a 200 OK response when the provided service token matches the expected token.
func TestRequireServiceAuthAcceptsMatchingToken(t *testing.T) {
	t.Setenv("GATEWAY_SERVICE_TOKEN", "expected-token")

	app := fiber.New()
	app.Get("/internal", RequireServiceAuth, func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	req := httptest.NewRequest("GET", "/internal", nil)
	req.Header.Set("X-Service-Token", "expected-token")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
	}
}
