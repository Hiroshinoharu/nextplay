package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/gateway/clients"
)

// TestGetGatewayHealthReturnsOK tests that GetGatewayHealth returns status 200
// when invoked with a valid request. It also tests that the response body contains
// the expected status and gateway information.
func TestGetGatewayHealthReturnsOK(t *testing.T) {
	app := fiber.New()
	app.Get("/health", GetGatewayHealth)

	resp, err := app.Test(httptest.NewRequest("GET", "/health", nil))
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
	if body["status"] != "ok" {
		t.Fatalf("expected status ok, got %#v", body)
	}
	if gateway, ok := body["gateway"].(bool); !ok || !gateway {
		t.Fatalf("expected gateway=true, got %#v", body)
	}
}

// TestGetAllHealthReturnsOKWhenUpstreamsAreHealthy tests that GetAllHealth returns status 200
// when invoked with a valid request, and all upstream services are healthy. It also tests that
// the response body contains the expected status and service information.
func TestGetAllHealthReturnsOKWhenUpstreamsAreHealthy(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/health" {
			t.Fatalf("expected /health path, got %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	defer server.Close()

	restoreGatewayClients(t, server.URL, server.URL, server.URL, server.Client())

	app := fiber.New()
	app.Get("/health/all", GetAllHealth)

	resp, err := app.Test(httptest.NewRequest("GET", "/health/all", nil))
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
	if ok, okType := body["ok"].(bool); !okType || !ok {
		t.Fatalf("expected ok=true, got %#v", body)
	}

	services, ok := body["services"].(map[string]any)
	if !ok {
		t.Fatalf("expected services object, got %#v", body["services"])
	}
	for _, name := range []string{"gateway", "user", "game", "recommender"} {
		service, ok := services[name].(map[string]any)
		if !ok {
			t.Fatalf("expected %s service object, got %#v", name, services[name])
		}
		if service["status"] != "ok" {
			t.Fatalf("expected %s status ok, got %#v", name, service)
		}
	}
}

// TestGetAllHealthReturnsServiceUnavailableWhenURLMissing tests that GetAllHealth returns a 503 Service Unavailable when
// the GATEWAY_SERVICE_TOKEN or SERVICE_TOKEN environment variable is not set. It also tests that
// the response body contains the expected status and gateway information.
func TestGetAllHealthReturnsServiceUnavailableWhenURLMissing(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	defer server.Close()

	restoreGatewayClients(t, server.URL, "", server.URL, server.Client())

	app := fiber.New()
	app.Get("/health/all", GetAllHealth)

	resp, err := app.Test(httptest.NewRequest("GET", "/health/all", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", fiber.StatusServiceUnavailable, resp.StatusCode)
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	services := body["services"].(map[string]any)
	game := services["game"].(map[string]any)
	if game["status"] != "error" {
		t.Fatalf("expected game service error, got %#v", game)
	}
}

func TestGetUserHealthPassesThroughUpstreamStatusAndBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte(`{"status":"degraded"}`))
	}))
	defer server.Close()

	restoreGatewayClients(t, server.URL, "", "", server.Client())

	app := fiber.New()
	app.Get("/health/user", GetUserHealth)

	resp, err := app.Test(httptest.NewRequest("GET", "/health/user", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, resp.StatusCode)
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["status"] != "degraded" {
		t.Fatalf("expected passthrough body, got %#v", body)
	}
}

// restoreGatewayClients is a helper function for tests that temporarily sets the
// Gateway's client URLs and HTTP client to the specified values. It resets the
// values to their original values after the test is finished. This is useful
// for mocking out the Gateway's upstream services in tests.
func restoreGatewayClients(t *testing.T, userURL string, gameURL string, recommenderURL string, httpClient *http.Client) {
	t.Helper()

	oldUserURL := clients.UserServiceURL
	oldGameURL := clients.GameServiceURL
	oldRecommenderURL := clients.RecommenderServiceURL
	oldHTTPClient := clients.HttpClient

	clients.UserServiceURL = userURL
	clients.GameServiceURL = gameURL
	clients.RecommenderServiceURL = recommenderURL
	clients.HttpClient = httpClient

	t.Cleanup(func() {
		clients.UserServiceURL = oldUserURL
		clients.GameServiceURL = oldGameURL
		clients.RecommenderServiceURL = oldRecommenderURL
		clients.HttpClient = oldHTTPClient
	})
}
