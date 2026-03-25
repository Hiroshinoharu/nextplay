package routes

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	gatewayauth "github.com/maxceban/nextplay/services/gateway/auth"
)

func TestDeleteUserRouteMatchesWithoutTrailingSlashAndForwardsSessionAuth(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	token, err := gatewayauth.CreateToken(42)
	if err != nil {
		t.Fatalf("CreateToken returned error: %v", err)
	}

	upstreamCalled := false
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamCalled = true

		if r.Method != http.MethodDelete {
			t.Fatalf("unexpected upstream method: %s", r.Method)
		}
		if r.URL.Path != "/users/42" {
			t.Fatalf("unexpected upstream path: %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer "+token {
			t.Fatalf("expected forwarded authorization header, got %q", got)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"message":"Delete user","user_id":"42"}`)
	}))
	defer upstream.Close()

	t.Setenv("USER_SERVICE_URL", upstream.URL)

	app := fiber.New()
	SetUpRoutes(app)

	csrfToken := "csrf-token"
	req := httptest.NewRequest(http.MethodDelete, "/api/users/42", nil)
	req.AddCookie(&http.Cookie{Name: gatewayauth.SessionCookieName(), Value: token})
	req.AddCookie(&http.Cookie{Name: gatewayauth.CSRFCookieName(), Value: csrfToken})
	req.Header.Set(gatewayauth.CSRFHeaderName(), csrfToken)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}
	if !upstreamCalled {
		t.Fatalf("expected gateway to call the upstream user service")
	}

	var body struct {
		Message string `json:"message"`
		UserID  string `json:"user_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body.Message != "Delete user" || body.UserID != "42" {
		t.Fatalf("unexpected delete response: %#v", body)
	}
}
