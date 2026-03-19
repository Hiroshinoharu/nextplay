package handlers

import (
	"bytes"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// TestSearchGamesByNameRequiresQuery tests that the SearchGamesByName handler
// returns a 400 Bad Request status code when the query parameter q is
// not provided.
func TestSearchGamesByNameRequiresQuery(t *testing.T) {
	app := fiber.New()
	app.Get("/games/search", SearchGamesByName)

	resp, err := app.Test(httptest.NewRequest("GET", "/games/search", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

// TestGetGameByIDRejectsInvalidID tests that the GetGameByID handler
// returns a 400 Bad Request status code when an invalid game ID is provided.
func TestGetGameByIDRejectsInvalidID(t *testing.T) {
	app := fiber.New()
	app.Get("/games/:id", GetGameByID)

	resp, err := app.Test(httptest.NewRequest("GET", "/games/not-a-number", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

// TestGetRelatedAddOnContentRejectsInvalidID tests that the GetRelatedAddOnContent handler
// returns a 400 Bad Request status code when an invalid game ID is provided.
func TestGetRelatedAddOnContentRejectsInvalidID(t *testing.T) {
	app := fiber.New()
	app.Get("/games/:id/related-content", GetRelatedAddOnContent)

	resp, err := app.Test(httptest.NewRequest("GET", "/games/not-a-number/related-content", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

// TestCreateGameRejectsMalformedJSON tests that the CreateGame handler
// returns a 400 Bad Request status code when a malformed JSON body is provided.
func TestCreateGameRejectsMalformedJSON(t *testing.T) {
	app := fiber.New()
	app.Post("/games", CreateGame)

	req := httptest.NewRequest("POST", "/games", bytes.NewBufferString("{"))
	req.Header.Set("Content-Type", fiber.MIMEApplicationJSON)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

// TestUpdateGameRejectsInvalidID tests that the UpdateGame handler
// returns a 400 Bad Request status code when an invalid game ID is provided.
func TestUpdateGameRejectsInvalidID(t *testing.T) {
	app := fiber.New()
	app.Put("/games/:id", UpdateGame)

	resp, err := app.Test(httptest.NewRequest("PUT", "/games/not-a-number", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

// TestUpdateGameRejectsMalformedJSON tests that the UpdateGame handler
// returns a 400 Bad Request status code when a malformed JSON body is provided.
func TestUpdateGameRejectsMalformedJSON(t *testing.T) {
	app := fiber.New()
	app.Put("/games/:id", UpdateGame)

	req := httptest.NewRequest("PUT", "/games/42", bytes.NewBufferString("{"))
	req.Header.Set("Content-Type", fiber.MIMEApplicationJSON)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

// TestDeleteGameRejectsInvalidID tests that the DeleteGame handler
// returns a 400 Bad Request status code when an invalid game ID is provided.
func TestDeleteGameRejectsInvalidID(t *testing.T) {
	app := fiber.New()
	app.Delete("/games/:id", DeleteGame)

	resp, err := app.Test(httptest.NewRequest("DELETE", "/games/not-a-number", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}
