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
func doGet(url string) (interface{}, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
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
		return nil, errors.New(string(body))
	}

	// Return the unmarshaled data and no error
	return data, nil
}

// Helper function to perform POST requests 
func doPost(url string, body []byte) (interface{}, error) {
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
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
		return nil, errors.New(string(raw))
	}

	// Return the unmarshaled data and no error
	return data, nil
}

// Helper function to perform PUT requests
func doPut(url string, body []byte) (interface{}, error) {
	req, err := http.NewRequest(http.MethodPut, url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := HttpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	var data interface{}
	_ = json.Unmarshal(raw, &data)
	if resp.StatusCode >= 400 {
		return nil, errors.New(string(raw))
	}
	return data, nil
}

// Helper function to perform DELETE requests
func doDelete(url string) (interface{}, error) {
	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return nil, err
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
		return nil, errors.New(string(raw))
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
