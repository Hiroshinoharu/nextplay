package handlers

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// TestForwardingHeadersIncludeAuthorizationAndServiceToken tests that the forwardingHeaders function
// correctly includes the Authorization and X-Service-Token headers when forwarding requests.
// It also tests that the request ID is included in the forwarded headers.
func TestForwardingHeadersIncludeAuthorizationAndServiceToken(t *testing.T) {
	t.Setenv("GATEWAY_SERVICE_TOKEN", "expected-token")

	app := fiber.New()
	app.Get("/headers", func(c *fiber.Ctx) error {
		headers := forwardingHeaders(c)
		if headers["Authorization"] != "Bearer user-token" {
			t.Fatalf("expected Authorization header to be forwarded")
		}
		if headers["X-Service-Token"] != "expected-token" {
			t.Fatalf("expected service token to be forwarded")
		}
		if headers["X-Request-ID"] == "" {
			t.Fatalf("expected request id to be included")
		}
		return c.SendStatus(fiber.StatusNoContent)
	})

	req := httptest.NewRequest("GET", "/headers", nil)
	req.Header.Set("Authorization", "Bearer user-token")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
	}
}
