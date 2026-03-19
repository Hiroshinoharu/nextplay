package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	gatewayauth "github.com/maxceban/nextplay/services/gateway/auth"
)

func TestLoginUserSetsSessionAndCSRFCookiesAndStripsToken(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/users/login" {
			t.Fatalf("unexpected upstream path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"id":42,"username":"player","email":"player@example.com","token":"jwt-token"}`)
	}))
	defer upstream.Close()

	t.Setenv("USER_SERVICE_URL", upstream.URL)

	app := fiber.New()
	app.Post("/api/users/login", LoginUser)

	req := httptest.NewRequest("POST", "/api/users/login", strings.NewReader(`{"email":"player@example.com","password":"Secret123!"}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if _, ok := body["token"]; ok {
		t.Fatalf("expected token to be stripped from gateway response")
	}
	if body["username"] != "player" {
		t.Fatalf("expected username in response, got %#v", body)
	}

	sessionCookie := findHandlerCookie(resp.Cookies(), gatewayauth.SessionCookieName())
	if sessionCookie == nil {
		t.Fatalf("expected session cookie to be set")
	}
	if sessionCookie.Value != "jwt-token" {
		t.Fatalf("expected session cookie value to match token")
	}
	if !sessionCookie.HttpOnly {
		t.Fatalf("expected session cookie to be HttpOnly")
	}

	csrfCookie := findHandlerCookie(resp.Cookies(), gatewayauth.CSRFCookieName())
	if csrfCookie == nil {
		t.Fatalf("expected csrf cookie to be set")
	}
	if csrfCookie.Value == "" {
		t.Fatalf("expected csrf cookie value to be populated")
	}
	if csrfCookie.HttpOnly {
		t.Fatalf("expected csrf cookie to be readable by the browser")
	}
}

func TestRegisterUserSetsSessionAndCSRFCookiesAndStripsToken(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/users/register" {
			t.Fatalf("unexpected upstream path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"id":7,"username":"new-player","email":"new@example.com","token":"register-token"}`)
	}))
	defer upstream.Close()

	t.Setenv("USER_SERVICE_URL", upstream.URL)

	app := fiber.New()
	app.Post("/api/users/register", RegisterUser)

	req := httptest.NewRequest("POST", "/api/users/register", strings.NewReader(`{"username":"new-player","email":"new@example.com","password":"Secret123!"}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if _, ok := body["token"]; ok {
		t.Fatalf("expected token to be stripped from gateway response")
	}
	if body["username"] != "new-player" {
		t.Fatalf("expected username in response, got %#v", body)
	}

	sessionCookie := findHandlerCookie(resp.Cookies(), gatewayauth.SessionCookieName())
	if sessionCookie == nil || sessionCookie.Value != "register-token" {
		t.Fatalf("expected register session cookie to be set")
	}
	if csrfCookie := findHandlerCookie(resp.Cookies(), gatewayauth.CSRFCookieName()); csrfCookie == nil || csrfCookie.Value == "" {
		t.Fatalf("expected register csrf cookie to be set")
	}
}

func TestGetCSRFTokenReturnsAndSetsCookie(t *testing.T) {
	app := fiber.New()
	app.Get("/api/users/csrf", GetCSRFToken)

	resp, err := app.Test(httptest.NewRequest("GET", "/api/users/csrf", nil))
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
	if strings.TrimSpace(body["csrf_token"]) == "" {
		t.Fatalf("expected csrf token in response body")
	}

	csrfCookie := findHandlerCookie(resp.Cookies(), gatewayauth.CSRFCookieName())
	if csrfCookie == nil {
		t.Fatalf("expected csrf cookie to be set")
	}
	if csrfCookie.Value != body["csrf_token"] {
		t.Fatalf("expected csrf response body and cookie to match")
	}
}

func TestLogoutUserClearsSessionAndCSRFCookies(t *testing.T) {
	app := fiber.New()
	app.Post("/api/users/logout", LogoutUser)

	resp, err := app.Test(httptest.NewRequest("POST", "/api/users/logout", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
	}

	sessionCookie := findHandlerCookie(resp.Cookies(), gatewayauth.SessionCookieName())
	if sessionCookie == nil {
		t.Fatalf("expected logout to clear the session cookie")
	}
	if sessionCookie.Value != "" {
		t.Fatalf("expected cleared session cookie value to be empty")
	}

	csrfCookie := findHandlerCookie(resp.Cookies(), gatewayauth.CSRFCookieName())
	if csrfCookie == nil {
		t.Fatalf("expected logout to clear the csrf cookie")
	}
	if csrfCookie.Value != "" {
		t.Fatalf("expected cleared csrf cookie value to be empty")
	}
}

func findHandlerCookie(cookies []*http.Cookie, name string) *http.Cookie {
	for _, cookie := range cookies {
		if cookie.Name == name {
			return cookie
		}
	}
	return nil
}
