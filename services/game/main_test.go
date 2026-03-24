package main

import "testing"

func TestResolveAllowedOriginsUsesConfiguredFrontendAndLocalDefaults(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "")

	origins := resolveAllowedOrigins("http://frontend.example")
	expected := "http://frontend.example,http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
	if origins != expected {
		t.Fatalf("expected origins %q, got %q", expected, origins)
	}
}

// TestResolveAllowedOriginsSkipsWildcardFromEnvironment tests that the
// resolveAllowedOrigins function properly ignores the wildcard (*) value
// when resolving the allowed origins from the environment variable.
func TestResolveAllowedOriginsSkipsWildcardFromEnvironment(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "*, http://localhost:5173, http://localhost:5173, https://app.example")

	origins := resolveAllowedOrigins("http://frontend.example")
	expected := "http://localhost:5173,https://app.example"
	if origins != expected {
		t.Fatalf("expected origins %q, got %q", expected, origins)
	}
}
