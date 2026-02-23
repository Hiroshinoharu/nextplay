package clients

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

// UpstreamError captures non-2xx response from the Recommender Service.
type UpstreamError struct {
	StatusCode int
	Message    string
}

func (e *UpstreamError) Error() string {
	return fmt.Sprintf("Recommender service error: %d - %s", e.StatusCode, e.Message)
}

func readResponse(resp *http.Response) ([]byte, error) {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// If the response body is empty, use the HTTP status text as the message
		message := strings.TrimSpace(string(body))
		if message == "" {
			message = http.StatusText(resp.StatusCode)
		}

		// Log the error details for debugging purposes
		fmt.Printf("Recommender service error: %d - %s\n", resp.StatusCode, message)
		return nil, &UpstreamError{
			StatusCode: resp.StatusCode,
			Message:    message,
		}
	}

	return body, nil
}

// RecommenderClient is a client for interacting with the Recommender Service.
type RecommenderClient struct {
	BaseURL string
}

// NewRecommenderClient initializes a new RecommenderClient with the base URL from environment variables or defaults.
func NewRecommenderClient() *RecommenderClient {
	baseURL := os.Getenv("RECOMMENDER_SERVICE_URL")
	if baseURL == "" {
		baseURL = "http://recommender:8082"
	}
	return &RecommenderClient{BaseURL: baseURL}
}

// RecommendFromFeatures fetches recommendations based on provided item features.
func (c *RecommenderClient) RecommendFromFeatures(req interface{}) ([]byte, error) {
	// Construct the URL for the recommendation endpoint
	url := fmt.Sprintf("%s/recommend", c.BaseURL)

	body, _ := json.Marshal(req)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return readResponse(resp)
}

// RecommendForUser fetches recommendations for a specific user ID.
func (c *RecommenderClient) RecommendForUser(userID string) ([]byte, error) {
	url := fmt.Sprintf("%s/recommend/user/%s", c.BaseURL, userID)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return readResponse(resp)
}

// RecommendForItem fetches recommendations based on a specific item ID.
func (c *RecommenderClient) RecommendForItem(itemID string) ([]byte, error) {
	url := fmt.Sprintf("%s/recommend/item/%s", c.BaseURL, itemID)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return readResponse(resp)
}

// RecommendSimilar fetches items similar to the provided item features.
func (c *RecommenderClient) RecommendSimilar(body []byte) ([]byte, error) {
	url := fmt.Sprintf("%s/recommend/item", c.BaseURL)

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return readResponse(resp)
}