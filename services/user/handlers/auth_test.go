package handlers

import (
	"bytes"
	"database/sql"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	userdb "github.com/maxceban/nextplay/services/user/db"
)

// TestCheckAvailabilityRequiresUsernameOrEmail tests that CheckAvailability returns status 400
// when no username or email is provided.
func TestCheckAvailabilityRequiresUsernameOrEmail(t *testing.T) {
	withUserDBReset(t)

	app := fiber.New()
	app.Get("/availability", CheckAvailability)

	resp, err := app.Test(httptest.NewRequest("GET", "/availability", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

// TestCheckAvailabilityRejectsInvalidEmail tests that CheckAvailability returns status 400
// when an invalid email is provided.
func TestCheckAvailabilityRejectsInvalidEmail(t *testing.T) {
	withUserDBReset(t)

	app := fiber.New()
	app.Get("/availability", CheckAvailability)

	resp, err := app.Test(httptest.NewRequest("GET", "/availability?email=invalid", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

// TestCheckAvailabilityReturnsServerErrorWhenDatabaseMissing tests that CheckAvailability returns status 500
// when the database is not initialized.
func TestCheckAvailabilityReturnsServerErrorWhenDatabaseMissing(t *testing.T) {
	withUserDBReset(t)

	app := fiber.New()
	app.Get("/availability", CheckAvailability)

	resp, err := app.Test(httptest.NewRequest("GET", "/availability?username=max", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusInternalServerError {
		t.Fatalf("expected status %d, got %d", fiber.StatusInternalServerError, resp.StatusCode)
	}
}

// TestRegisterRejectsInvalidJSON tests that Register returns status 400
// when an invalid JSON body is provided.
func TestRegisterRejectsInvalidJSON(t *testing.T) {
	withUserDBReset(t)

	app := fiber.New()
	app.Post("/register", Register)

	req := httptest.NewRequest("POST", "/register", bytes.NewBufferString("{"))
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

// TestRegisterRejectsInvalidInput tests that Register returns status 400
// when an invalid username, email or password is provided.
func TestRegisterRejectsInvalidInput(t *testing.T) {
	withUserDBReset(t)

	app := fiber.New()
	app.Post("/register", Register)

	body := `{"username":" ","email":"invalid","password":"weak"}`
	req := httptest.NewRequest("POST", "/register", bytes.NewBufferString(body))
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

// TestRegisterReturnsServerErrorWhenDatabaseMissing tests that Register returns status 500
// when the database is not initialized.
func TestRegisterReturnsServerErrorWhenDatabaseMissing(t *testing.T) {
	withUserDBReset(t)

	app := fiber.New()
	app.Post("/register", Register)

	body := `{"username":"max","email":"max@example.com","password":"Abcd1234!"}`
	req := httptest.NewRequest("POST", "/register", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", fiber.MIMEApplicationJSON)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusInternalServerError {
		t.Fatalf("expected status %d, got %d", fiber.StatusInternalServerError, resp.StatusCode)
	}
}

// TestLoginRejectsInvalidJSON tests that Login returns status 400
// when an invalid JSON is provided.
func TestLoginRejectsInvalidJSON(t *testing.T) {
	withUserDBReset(t)

	app := fiber.New()
	app.Post("/login", Login)

	req := httptest.NewRequest("POST", "/login", bytes.NewBufferString("{"))
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

// TestLoginRejectsInvalidInput tests that Login returns status 400
// when an invalid username or password is provided.
func TestLoginRejectsInvalidInput(t *testing.T) {
	withUserDBReset(t)

	app := fiber.New()
	app.Post("/login", Login)

	body := `{"username":"max"}`
	req := httptest.NewRequest("POST", "/login", bytes.NewBufferString(body))
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

// TestLoginReturnsServerErrorWhenDatabaseMissing tests that Login returns status 500
// when the database connection is missing.
func TestLoginReturnsServerErrorWhenDatabaseMissing(t *testing.T) {
	withUserDBReset(t)

	app := fiber.New()
	app.Post("/login", Login)

	body := `{"username":"max","password":"Abcd1234!"}`
	req := httptest.NewRequest("POST", "/login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", fiber.MIMEApplicationJSON)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusInternalServerError {
		t.Fatalf("expected status %d, got %d", fiber.StatusInternalServerError, resp.StatusCode)
	}
}

// TestChangePasswordRejectsInvalidJSON tests that ChangePassword returns status 400
// when an invalid JSON body is provided.
func TestChangePasswordRejectsInvalidJSON(t *testing.T) {
	withUserDBReset(t)

	app := fiber.New()
	app.Patch("/users/:id/password", ChangePassword)

	req := httptest.NewRequest("PATCH", "/users/42/password", bytes.NewBufferString("{"))
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

// TestChangePasswordRejectsMissingFields tests that ChangePassword returns status 400
// when either current_password or new_password is missing from the JSON body.
func TestChangePasswordRejectsMissingFields(t *testing.T) {
	withUserDBReset(t)

	app := fiber.New()
	app.Patch("/users/:id/password", ChangePassword)

	body := `{"current_password":"","new_password":""}`
	req := httptest.NewRequest("PATCH", "/users/42/password", bytes.NewBufferString(body))
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

// TestChangePasswordRejectsSamePassword tests that ChangePassword returns status 400
// when the same current and new password is provided.
func TestChangePasswordRejectsSamePassword(t *testing.T) {
	withUserDBReset(t)

	app := fiber.New()
	app.Patch("/users/:id/password", ChangePassword)

	body := `{"current_password":"Abcd1234!","new_password":"Abcd1234!"}`
	req := httptest.NewRequest("PATCH", "/users/42/password", bytes.NewBufferString(body))
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

// TestChangePasswordReturnsServerErrorWhenDatabaseMissing tests that ChangePassword returns status 500
// when the database connection is missing.
func TestChangePasswordReturnsServerErrorWhenDatabaseMissing(t *testing.T) {
	withUserDBReset(t)

	app := fiber.New()
	app.Patch("/users/:id/password", ChangePassword)

	body := `{"current_password":"Abcd1234!","new_password":"Newpass123!"}`
	req := httptest.NewRequest("PATCH", "/users/42/password", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", fiber.MIMEApplicationJSON)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusInternalServerError {
		t.Fatalf("expected status %d, got %d", fiber.StatusInternalServerError, resp.StatusCode)
	}
}

// withUserDBReset is a helper function that resets the userdb.DB to nil before a test, and sets it back to its original value after the test is complete. It is intended to be used with the testing.T.Helper function.
func withUserDBReset(t *testing.T) {
	t.Helper()

	oldDB := userdb.DB
	userdb.DB = nil
	t.Cleanup(func() {
		userdb.DB = oldDB
	})
}

var _ *sql.DB
