package clients

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
)

// HTTPError preserves upstream status codes and bodies for proxy responses.
type HTTPError struct {
	Status int
	Body   []byte
}

func (e *HTTPError) Error() string {
	return string(e.Body)
}

// Global HTTP client for all requests
var HttpClient = &http.Client{}

var (
	UserServiceURL string
	GameServiceURL string
	RecommenderServiceURL string
)

// Base URLs for different services 
func doGet(url string, headers map[string]string) (interface{}, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	resp, err := HttpClient.Do(req)
	if err != nil {
		return nil, err
	}
	// Close the response body when the function returns
	defer resp.Body.Close()

	// Read the response body
	body, _ := io.ReadAll(resp.Body)

	// Unmarshal the response into a generic container
	var data interface{}
	_ = json.Unmarshal(body, &data)

	// Check for HTTP error status codes
	if resp.StatusCode >= 400 {
		return nil, &HTTPError{Status: resp.StatusCode, Body: body}
	}

	// Return the unmarshaled data and no error
	return data, nil
}

// Helper function to perform POST requests 
func doPost(url string, body []byte, headers map[string]string) (interface{}, error) {
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	resp, err := HttpClient.Do(req)
	// Handle errors and read response
	if err != nil {
		return nil, err
	}

	// Close the response body when the function returns
	defer resp.Body.Close()

	// Read the response body
	raw, _ := io.ReadAll(resp.Body)

	// Unmarshal the response into a generic container
	var data interface{}
	_ = json.Unmarshal(raw, &data)

	// Check for HTTP error status codes
	if resp.StatusCode >= 400 {
		return nil, &HTTPError{Status: resp.StatusCode, Body: raw}
	}

	// Return the unmarshaled data and no error
	return data, nil
}

// Helper function to perform PUT requests
func doPut(url string, body []byte, headers map[string]string) (interface{}, error) {
	req, err := http.NewRequest(http.MethodPut, url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	resp, err := HttpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	var data interface{}
	_ = json.Unmarshal(raw, &data)
	if resp.StatusCode >= 400 {
		return nil, &HTTPError{Status: resp.StatusCode, Body: raw}
	}
	return data, nil
}

// Helper function to perform DELETE requests
func doDelete(url string, headers map[string]string) (interface{}, error) {
	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return nil, err
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	resp, err := HttpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	var data interface{}
	_ = json.Unmarshal(raw, &data)
	if resp.StatusCode >= 400 {
		return nil, &HTTPError{Status: resp.StatusCode, Body: raw}
	}
	return data, nil
}

// Helper function to perform GET requests returning raw response data
func doGetRaw(url string) (int, []byte, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return 0, nil, err
	}
	resp, err := HttpClient.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, nil, err
	}
	return resp.StatusCode, data, nil
}

// GetRaw exposes raw GET for handlers that need status passthrough
func GetRaw(url string) (int, []byte, error) {
	return doGetRaw(url)
}
