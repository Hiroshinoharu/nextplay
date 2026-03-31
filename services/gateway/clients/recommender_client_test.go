package clients

import "testing"

func TestNewRecommenderClientPrefersEnvironmentVariable(t *testing.T) {
	t.Setenv("RECOMMENDER_SERVICE_URL", "http://env-recommender:8082")

	old := RecommenderServiceURL
	RecommenderServiceURL = "http://configured-recommender:8082"
	t.Cleanup(func() {
		RecommenderServiceURL = old
	})

	client := NewRecommenderClient()
	if client.BaseURL != "http://env-recommender:8082" {
		t.Fatalf("expected env URL, got %q", client.BaseURL)
	}
}

func TestNewRecommenderClientUsesConfiguredFallback(t *testing.T) {
	t.Setenv("RECOMMENDER_SERVICE_URL", "")

	old := RecommenderServiceURL
	RecommenderServiceURL = "http://configured-recommender:8082"
	t.Cleanup(func() {
		RecommenderServiceURL = old
	})

	client := NewRecommenderClient()
	if client.BaseURL != "http://configured-recommender:8082" {
		t.Fatalf("expected configured URL, got %q", client.BaseURL)
	}
}

func TestNewRecommenderClientFallsBackToDefault(t *testing.T) {
	t.Setenv("RECOMMENDER_SERVICE_URL", "")

	old := RecommenderServiceURL
	RecommenderServiceURL = ""
	t.Cleanup(func() {
		RecommenderServiceURL = old
	})

	client := NewRecommenderClient()
	if client.BaseURL != "http://recommender:8082" {
		t.Fatalf("expected default URL, got %q", client.BaseURL)
	}
}

