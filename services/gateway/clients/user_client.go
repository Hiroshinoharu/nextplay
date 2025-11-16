package clients

import (
	"fmt"
	"os"
)

// UserClient struct to interact with User Service
type UserClient struct {
	BaseURL string
}

// Constructor for UserClient 
func NewUserClient() *UserClient {
	baseURL := os.Getenv("USER_SERVICE_URL")
	if baseURL == "" {
		baseURL = "http://user:8083"
	}
	return &UserClient{BaseURL: baseURL}
}

// GET /users/:id
func (c *UserClient) GetUserByID(id string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/users/%s", c.BaseURL, id)
	return doGet(url)
}

// POST /users
func (c *UserClient) CreateUser(body []byte) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/users", c.BaseURL)
	return doPost(url, body)
}

// POST /users/login
func (c *UserClient) LoginUser(body []byte) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/users/login", c.BaseURL)
	return doPost(url, body)
}

// GET /users/:id/preferences
func (c *UserClient) GetUserPreferences(id string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/users/%s/preferences", c.BaseURL, id)
	return doGet(url)
}

// GET /users/:id/interactions
func (c *UserClient) GetUserInteraction(id string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/users/%s/interactions", c.BaseURL, id)
	return doGet(url)
}

// POST /users/:id/preferences
func (c *UserClient) CreateUserPreference(id string, body []byte) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/users/%s/preferences", c.BaseURL, id)
	return doPost(url, body)
}

// POST /users/:id/interactions
func (c *UserClient) CreateUserInteraction(id string, body []byte) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/users/%s/interactions", c.BaseURL, id)
	return doPost(url, body)
}
