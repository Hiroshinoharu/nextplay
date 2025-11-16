package clients

import (
	"encoding/json"
	"fmt"
	"os"
)

type UserClient struct {
	BaseURL string
}

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
func (c *UserClient) CreateUser(req interface{}) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/users", c.BaseURL)

	body, _ := json.Marshal(req)
	return doPost(url, body)
}

// POST /users/login
func (c *UserClient) LoginUser(req interface{}) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/users/login", c.BaseURL)
	body, _ := json.Marshal(req)
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

