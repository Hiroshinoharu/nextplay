package middleware

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	userauth "github.com/maxceban/nextplay/services/user/auth"
)

func TestRequireJWTRejectsMissingToken(t *testing.T) {
	app := fiber.New()
	app.Get("/users/:id", RequireJWT, func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	resp, err := app.Test(httptest.NewRequest("GET", "/users/42", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", fiber.StatusUnauthorized, resp.StatusCode)
	}
}

func TestRequireJWTRejectsInvalidToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	app := fiber.New()
	app.Get("/users/:id", RequireJWT, func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	req := httptest.NewRequest("GET", "/users/42", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", fiber.StatusUnauthorized, resp.StatusCode)
	}
}

func TestRequireJWTRejectsMismatchedPathUser(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	token, err := userauth.CreateToken(42)
	if err != nil {
		t.Fatalf("CreateToken returned error: %v", err)
	}

	app := fiber.New()
	app.Get("/users/:id", RequireJWT, func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	req := httptest.NewRequest("GET", "/users/7", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("expected status %d, got %d", fiber.StatusForbidden, resp.StatusCode)
	}
}

func TestRequireJWTAcceptsValidTokenAndStoresUserID(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	token, err := userauth.CreateToken(42)
	if err != nil {
		t.Fatalf("CreateToken returned error: %v", err)
	}

	app := fiber.New()
	app.Get("/users/:id", RequireJWT, func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"user_id": c.Locals("user_id")})
	})

	req := httptest.NewRequest("GET", "/users/42", nil)
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
