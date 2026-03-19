package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	gatewayauth "github.com/maxceban/nextplay/services/gateway/auth"
)

func TestRequireCSRFIssuesCookieForSafeSessionRequest(t *testing.T) {
	app := fiber.New()
	app.Get("/protected", RequireCSRF, func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.AddCookie(&http.Cookie{Name: gatewayauth.SessionCookieName(), Value: "session-token"})
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
	}

	csrfCookie := findResponseCookie(resp.Cookies(), gatewayauth.CSRFCookieName())
	if csrfCookie == nil {
		t.Fatalf("expected csrf cookie to be issued")
	}
	if csrfCookie.Value == "" {
		t.Fatalf("expected csrf cookie value to be populated")
	}
}

func TestRequireCSRFRejectsUnsafeSessionRequestWithoutHeader(t *testing.T) {
	app := fiber.New()
	app.Post("/protected", RequireCSRF, func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodPost, "/protected", nil)
	req.AddCookie(&http.Cookie{Name: gatewayauth.SessionCookieName(), Value: "session-token"})
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("expected status %d, got %d", fiber.StatusForbidden, resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["error"] != "missing or invalid csrf token" {
		t.Fatalf("expected csrf error, got %#v", body)
	}

	csrfCookie := findResponseCookie(resp.Cookies(), gatewayauth.CSRFCookieName())
	if csrfCookie == nil || csrfCookie.Value == "" {
		t.Fatalf("expected csrf cookie to be issued on rejection")
	}
}

func TestRequireCSRFAcceptsMatchingCookieAndHeader(t *testing.T) {
	app := fiber.New()
	app.Post("/protected", RequireCSRF, func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodPost, "/protected", nil)
	req.AddCookie(&http.Cookie{Name: gatewayauth.SessionCookieName(), Value: "session-token"})
	req.AddCookie(&http.Cookie{Name: gatewayauth.CSRFCookieName(), Value: "csrf-token"})
	req.Header.Set(gatewayauth.CSRFHeaderName(), "csrf-token")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
	}
}

func TestRequireCSRFSkipsBearerAuthorizationRequests(t *testing.T) {
	app := fiber.New()
	app.Post("/protected", RequireCSRF, func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodPost, "/protected", nil)
	req.Header.Set("Authorization", "Bearer api-token")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
	}
}

func findResponseCookie(cookies []*http.Cookie, name string) *http.Cookie {
	for _, cookie := range cookies {
		if cookie.Name == name {
			return cookie
		}
	}
	return nil
}
