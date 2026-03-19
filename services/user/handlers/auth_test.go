package handlers

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/user/auth"
	userdb "github.com/maxceban/nextplay/services/user/db"
	usermodels "github.com/maxceban/nextplay/services/user/models"
)

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

func TestCheckAvailabilityReturnsAvailabilityPayload(t *testing.T) {
	withAuthStoreStubs(t)
	authStoreReady = func() bool { return true }
	lookupAuthIdentity = func(username, email string) (bool, bool, error) {
		if username != "max" || email != "max@example.com" {
			t.Fatalf("unexpected lookup args: %q %q", username, email)
		}
		return false, true, nil
	}

	app := fiber.New()
	app.Get("/availability", CheckAvailability)

	resp, err := app.Test(httptest.NewRequest("GET", "/availability?username=max&email=max@example.com", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}

	var body struct {
		Username struct {
			Value  string `json:"value"`
			Exists bool   `json:"exists"`
		} `json:"username"`
		Email struct {
			Value  string `json:"value"`
			Exists bool   `json:"exists"`
		} `json:"email"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body.Username.Value != "max" || body.Username.Exists {
		t.Fatalf("unexpected username availability payload: %#v", body)
	}
	if body.Email.Value != "max@example.com" || !body.Email.Exists {
		t.Fatalf("unexpected email availability payload: %#v", body)
	}
}

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

func TestRegisterReturnsCreatedUser(t *testing.T) {
	withAuthStoreStubs(t)
	t.Setenv("JWT_SECRET", "test-secret")
	authStoreReady = func() bool { return true }
	lookupAuthIdentity = func(username, email string) (bool, bool, error) {
		return false, false, nil
	}
	createAuthUser = func(username, hashedPassword, email string) (usermodels.User, error) {
		if hashedPassword == "Abcd1234!" {
			t.Fatal("expected password to be hashed before persistence")
		}
		return usermodels.User{ID: 9, Username: username, Email: email, SteamLinked: true}, nil
	}

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

	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("expected status %d, got %d", fiber.StatusCreated, resp.StatusCode)
	}

	var bodyResp struct {
		ID          int64  `json:"id"`
		Username    string `json:"username"`
		Email       string `json:"email"`
		SteamLinked bool   `json:"steam_linked"`
		Token       string `json:"token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&bodyResp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if bodyResp.ID != 9 || bodyResp.Username != "max" || bodyResp.Token == "" {
		t.Fatalf("unexpected register payload: %#v", bodyResp)
	}
}

func TestRegisterRejectsExistingUsername(t *testing.T) {
	withAuthStoreStubs(t)
	authStoreReady = func() bool { return true }
	lookupAuthIdentity = func(username, email string) (bool, bool, error) {
		return true, false, nil
	}

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

	if resp.StatusCode != fiber.StatusConflict {
		t.Fatalf("expected status %d, got %d", fiber.StatusConflict, resp.StatusCode)
	}
}

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

func TestLoginReturnsAuthenticatedUserByEmail(t *testing.T) {
	withAuthStoreStubs(t)
	t.Setenv("JWT_SECRET", "test-secret")
	authStoreReady = func() bool { return true }
	hashedPassword, err := auth.HashPassword("Abcd1234!")
	if err != nil {
		t.Fatalf("HashPassword returned error: %v", err)
	}
	getAuthUserByEmail = func(email string) (usermodels.User, string, error) {
		return usermodels.User{ID: 7, Username: "max", Email: email, SteamLinked: true}, hashedPassword, nil
	}

	app := fiber.New()
	app.Post("/login", Login)

	body := `{"email":"max@example.com","password":"Abcd1234!"}`
	req := httptest.NewRequest("POST", "/login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", fiber.MIMEApplicationJSON)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}

	var bodyResp struct {
		ID    int64  `json:"id"`
		Email string `json:"email"`
		Token string `json:"token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&bodyResp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if bodyResp.ID != 7 || bodyResp.Email != "max@example.com" || bodyResp.Token == "" {
		t.Fatalf("unexpected login payload: %#v", bodyResp)
	}
}

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

func TestChangePasswordReturnsSuccess(t *testing.T) {
	withAuthStoreStubs(t)
	authStoreReady = func() bool { return true }
	storedPassword, err := auth.HashPassword("Abcd1234!")
	if err != nil {
		t.Fatalf("HashPassword returned error: %v", err)
	}
	getAuthPasswordHashByUserID = func(id string) (string, error) {
		if id != "42" {
			t.Fatalf("expected user id 42, got %q", id)
		}
		return storedPassword, nil
	}
	saveAuthPasswordHash = func(id string, hashedPassword string) (int64, error) {
		if id != "42" {
			t.Fatalf("expected user id 42, got %q", id)
		}
		if hashedPassword == "Newpass123!" {
			t.Fatal("expected new password to be hashed before persistence")
		}
		return 1, nil
	}

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

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}
}

func withUserDBReset(t *testing.T) {
	t.Helper()

	oldDB := userdb.DB
	userdb.DB = nil
	t.Cleanup(func() {
		userdb.DB = oldDB
	})
}

func withAuthStoreStubs(t *testing.T) {
	t.Helper()

	oldAuthStoreReady := authStoreReady
	oldLookupAuthIdentity := lookupAuthIdentity
	oldCreateAuthUser := createAuthUser
	oldGetAuthUserByUsername := getAuthUserByUsername
	oldGetAuthUserByEmail := getAuthUserByEmail
	oldUpgradeAuthPasswordHash := upgradeAuthPasswordHash
	oldGetAuthPasswordHashByUserID := getAuthPasswordHashByUserID
	oldSaveAuthPasswordHash := saveAuthPasswordHash

	t.Cleanup(func() {
		authStoreReady = oldAuthStoreReady
		lookupAuthIdentity = oldLookupAuthIdentity
		createAuthUser = oldCreateAuthUser
		getAuthUserByUsername = oldGetAuthUserByUsername
		getAuthUserByEmail = oldGetAuthUserByEmail
		upgradeAuthPasswordHash = oldUpgradeAuthPasswordHash
		getAuthPasswordHashByUserID = oldGetAuthPasswordHashByUserID
		saveAuthPasswordHash = oldSaveAuthPasswordHash
	})
}
