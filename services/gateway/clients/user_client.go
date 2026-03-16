package clients

import (
	"fmt"
	"os"
	"strings"
)

// UserClient struct to interact with User Service
type UserClient struct {
	BaseURL    string
	AuthHeader string
	RequestID  string
}

// Constructor for UserClient
func NewUserClient() *UserClient {
	baseURL := strings.TrimSpace(os.Getenv("USER_SERVICE_URL"))
	if baseURL == "" {
		baseURL = strings.TrimSpace(UserServiceURL)
	}
	if baseURL == "" {
		baseURL = "http://user:8083"
	}
	return &UserClient{BaseURL: baseURL}
}

// Constructor for UserClient with forwarding headers.
func NewUserClientWithHeaders(authHeader string, requestID string) *UserClient {
	// Create a new UserClient instance
	client := NewUserClient()
	client.AuthHeader = strings.TrimSpace(authHeader)
	client.RequestID = strings.TrimSpace(requestID)
	return client
}

// Helper to prepare headers
func (c *UserClient) headers() map[string]string {
	headers := map[string]string{}
	if c.AuthHeader != "" {
		headers["Authorization"] = c.AuthHeader
	}
	if c.RequestID != "" {
		headers["X-Request-ID"] = c.RequestID
	}
	if len(headers) == 0 {
		return nil
	}
	return headers
}

// GET /users/:id
func (c *UserClient) GetUserByID(id string) (interface{}, error) {
	url := fmt.Sprintf("%s/users/%s", c.BaseURL, id)
	return doGet(url, c.headers())
}

// POST /users/register
func (c *UserClient) RegisterUser(body []byte) (interface{}, error) {
	url := fmt.Sprintf("%s/users/register", c.BaseURL)
	return doPost(url, body, c.headers())
}

// POST /users/login
func (c *UserClient) LoginUser(body []byte) (interface{}, error) {
	url := fmt.Sprintf("%s/users/login", c.BaseURL)
	return doPost(url, body, c.headers())
}

// GET /users/:id/interactions
func (c *UserClient) GetUserInteraction(id string) (interface{}, error) {
	url := fmt.Sprintf("%s/users/%s/interactions", c.BaseURL, id)
	return doGet(url, c.headers())
}

// POST /users/:id/interactions
func (c *UserClient) CreateUserInteraction(id string, body []byte) (interface{}, error) {
	url := fmt.Sprintf("%s/users/%s/interactions", c.BaseURL, id)
	return doPost(url, body, c.headers())
}

// DELETE /users/:id/interactions/:gameId
func (c *UserClient) DeleteUserInteraction(id, gameId string) (interface{}, error) {
	url := fmt.Sprintf("%s/users/%s/interactions/%s", c.BaseURL, id, gameId)
	return doDelete(url, c.headers())
}

// GET /users/:id/interactions/events
func (c *UserClient) GetUserInteractionEvents(id string) (interface{}, error) {
	url := fmt.Sprintf("%s/users/%s/interactions/events", c.BaseURL, id)
	return doGet(url, c.headers())
}

// POST /users/:id/interactions/events
func (c *UserClient) CreateUserInteractionEvent(id string, body []byte) (interface{}, error) {
	url := fmt.Sprintf("%s/users/%s/interactions/events", c.BaseURL, id)
	return doPost(url, body, c.headers())
}

// PUT /users/:id
func (c *UserClient) UpdateUser(id string, body []byte) (interface{}, error) {
	url := fmt.Sprintf("%s/users/%s", c.BaseURL, id)
	return doPut(url, body, c.headers())
}

// PATCH /users/:id/password
func (c *UserClient) ChangePassword(id string, body []byte) (interface{}, error) {
	url := fmt.Sprintf("%s/users/%s/password", c.BaseURL, id)
	return doPatch(url, body, c.headers())
}

// DELETE /users/:id
func (c *UserClient) DeleteUser(id string) (interface{}, error) {
	url := fmt.Sprintf("%s/users/%s", c.BaseURL, id)
	return doDelete(url, c.headers())
}
