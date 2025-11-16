package clients

import (
	"fmt"
	"os"
)

type GameClient struct {
	BaseURL string
}

func NewGameClient() *GameClient {
	baseURL := os.Getenv("GAME_SERVICE_URL")
	if baseURL == "" {
		baseURL = "http://game:8081" // container DNS
	}
	return &GameClient{BaseURL: baseURL}
}

// GET /games/:id
func (c *GameClient) GetGameByID(id string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/games/%s", c.BaseURL, id)
	return doGet(url)
}

// GET /games
func (c *GameClient) GetAllGames() (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/games", c.BaseURL)
	return doGet(url)
}

// GET /games/:id/companies
func (c *GameClient) GetGameCompanies(id string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/games/%s/companies", c.BaseURL, id)
	return doGet(url)
}

// GET /games/:id/platforms
func (c *GameClient) GetGamePlatforms(id string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/games/%s/platforms", c.BaseURL, id)
	return doGet(url)
}

// GET /games/:id/keywords
func (c *GameClient) GetGameKeywords(id string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/games/%s/keywords", c.BaseURL, id)
	return doGet(url)
}