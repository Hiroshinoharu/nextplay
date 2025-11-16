package clients

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

// Global HTTP client for all requests
var HttpClient = &http.Client{}

var (
	UserServiceURL string
	GameServiceURL string
	RecommenderServiceURL string
)

// Base URLs for different services 
func doGet(url string) (map[string]interface{}, error) {
	// Perform the HTTP GET request
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	// Close the response body when the function returns
	defer resp.Body.Close()

	// Read the response body
	body, _ := io.ReadAll(resp.Body)

	// Unmarshal the response into a map
	var data map[string]interface{}
	json.Unmarshal(body, &data)

	// Check for HTTP error status codes
	if resp.StatusCode >= 400 {
		return nil, errors.New(string(body))
	}

	// Return the unmarshaled data and no error
	return data, nil
}

// Helper function to perform POST requests 
func doPost(url string, body []byte) (map[string]interface{}, error) {
	// Perform the HTTP POST request
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(body))
	// Handle errors and read response
	if err != nil {
		return nil, err
	}

	// Close the response body when the function returns
	defer resp.Body.Close()

	// Read the response body
	raw, _ := io.ReadAll(resp.Body)

	// Unmarshal the response into a map
	var data map[string]interface{}
	json.Unmarshal(raw, &data)

	// Check for HTTP error status codes
	if resp.StatusCode >= 400 {
		return nil, errors.New(string(raw))
	}

	// Return the unmarshaled data and no error
	return data, nil
}