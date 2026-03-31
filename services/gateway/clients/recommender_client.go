package clients

import (
	"bytes"
	"encoding/json"
	"fmt"
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
	body, err := readResponseBody(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		message := http.StatusText(resp.StatusCode)
		if resp.StatusCode < 500 {
			if trimmed := strings.TrimSpace(string(body)); trimmed != "" {
				message = trimmed
			}
		}
		return nil, &UpstreamError{
			StatusCode: resp.StatusCode,
			Message:    message,
		}
	}

	return body, nil
}

func setHeaders(req *http.Request, headers map[string]string) {
	for key, value := range headers {
		req.Header.Set(key, value)
	}
}

// RecommenderClient is a client for interacting with the Recommender Service.
type RecommenderClient struct {
	BaseURL string
}

// NewRecommenderClient initializes a new RecommenderClient with the base URL from environment variables or defaults.
func NewRecommenderClient() *RecommenderClient {
	baseURL := strings.TrimSpace(os.Getenv("RECOMMENDER_SERVICE_URL"))
	if baseURL == "" {
		baseURL = strings.TrimSpace(RecommenderServiceURL)
	}
	if baseURL == "" {
		baseURL = "http://recommender:8082"
	}
	return &RecommenderClient{BaseURL: baseURL}
}

// RecommendFromFeatures fetches recommendations based on provided item features.
func (c *RecommenderClient) RecommendFromFeatures(req interface{}, headers map[string]string) ([]byte, error) {
	url := fmt.Sprintf("%s/recommend", c.BaseURL)
	body, _ := json.Marshal(req)

	httpReq, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	setHeaders(httpReq, headers)

	resp, err := HttpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return readResponse(resp)
}

// RecommendForUser fetches recommendations for a specific user ID.
func (c *RecommenderClient) RecommendForUser(userID string, headers map[string]string) ([]byte, error) {
	url := fmt.Sprintf("%s/recommend/user/%s", c.BaseURL, userID)

	httpReq, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	setHeaders(httpReq, headers)

	resp, err := HttpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return readResponse(resp)
}

// RecommendForItem fetches recommendations based on a specific item ID.
func (c *RecommenderClient) RecommendForItem(itemID string, headers map[string]string) ([]byte, error) {
	url := fmt.Sprintf("%s/recommend/item/%s", c.BaseURL, itemID)

	httpReq, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	setHeaders(httpReq, headers)

	resp, err := HttpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return readResponse(resp)
}

// RecommendSimilar fetches items similar to the provided item features.
func (c *RecommenderClient) RecommendSimilar(body []byte, headers map[string]string) ([]byte, error) {
	url := fmt.Sprintf("%s/recommend/item", c.BaseURL)

	httpReq, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	setHeaders(httpReq, headers)

	resp, err := HttpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return readResponse(resp)
}

