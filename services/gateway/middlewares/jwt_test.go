package middleware

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	gatewayauth "github.com/maxceban/nextplay/services/gateway/auth"
)

func TestRequireJWTRejectsMissingToken(t *testing.T) {
	app := fiber.New()
	app.Get("/protected", RequireJWT, func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true})
	})

	resp, err := app.Test(httptest.NewRequest("GET", "/protected", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", fiber.StatusUnauthorized, resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["error"] != "missing or invalid token" {
		t.Fatalf("expected auth error, got %#v", body)
	}
}

func TestRequireJWTAcceptsValidTokenAndStoresUserID(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	token, err := gatewayauth.CreateToken(42)
	if err != nil {
		t.Fatalf("CreateToken returned error: %v", err)
	}

	app := fiber.New()
	app.Get("/protected", RequireJWT, func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"user_id": c.Locals("user_id")})
	})

	req := httptest.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["user_id"] != "42" {
		t.Fatalf("expected user_id 42, got %#v", body)
	}
}

// TestRequireSameUserParamRejectsMismatchedUser tests that RequireSameUserParam rejects
// requests with mismatched user IDs.
func TestRequireSameUserParamRejectsMismatchedUser(t *testing.T) {
	app := fiber.New()
	app.Get("/users/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", "42")
		return c.Next()
	}, RequireSameUserParam("id"), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	resp, err := app.Test(httptest.NewRequest("GET", "/users/7", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("expected status %d, got %d", fiber.StatusForbidden, resp.StatusCode)
	}
}

// TestRequireSameUserParamRejectsMalformedID tests that RequireSameUserParam rejects
// requests with malformed user IDs.
func TestRequireSameUserParamRejectsMalformedID(t *testing.T) {
	app := fiber.New()
	app.Get("/users/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", "42")
		return c.Next()
	}, RequireSameUserParam("id"), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	resp, err := app.Test(httptest.NewRequest("GET", "/users/not-a-number", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}
