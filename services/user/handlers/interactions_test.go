package handlers

import (
	"bytes"
	"database/sql"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	userdb "github.com/maxceban/nextplay/services/user/db"
)

func TestGetInteractionsReturnsNotFoundWhenUserIsDeleted(t *testing.T) {
	withActiveUserExistsStub(t, func(id string) (bool, error) {
		if id != "42" {
			t.Fatalf("expected user id 42, got %q", id)
		}
		return false, nil
	})
	withNonNilUserDB(t)

	app := fiber.New()
	app.Get("/users/:id/interactions", GetInteractions)

	resp, err := app.Test(httptest.NewRequest(fiber.MethodGet, "/users/42/interactions", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("expected status %d, got %d", fiber.StatusNotFound, resp.StatusCode)
	}
}

func TestAddOrUpdateInteractionReturnsNotFoundWhenUserIsDeleted(t *testing.T) {
	withActiveUserExistsStub(t, func(id string) (bool, error) {
		if id != "42" {
			t.Fatalf("expected user id 42, got %q", id)
		}
		return false, nil
	})
	withNonNilUserDB(t)

	app := fiber.New()
	app.Post("/users/:id/interactions", AddOrUpdateInteraction)

	req := httptest.NewRequest(
		fiber.MethodPost,
		"/users/42/interactions",
		bytes.NewBufferString(`{"game_id":7}`),
	)
	req.Header.Set("Content-Type", fiber.MIMEApplicationJSON)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("expected status %d, got %d", fiber.StatusNotFound, resp.StatusCode)
	}
}

func withActiveUserExistsStub(t *testing.T, stub func(id string) (bool, error)) {
	t.Helper()

	oldActiveUserExists := activeUserExists
	activeUserExists = stub
	t.Cleanup(func() {
		activeUserExists = oldActiveUserExists
	})
}

func withNonNilUserDB(t *testing.T) {
	t.Helper()

	oldDB := userdb.DB
	userdb.DB = &sql.DB{}
	t.Cleanup(func() {
		userdb.DB = oldDB
	})
}
