package clients

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

type GameClient struct {
	baseURL string
	client  *http.Client
}

func NewGameClient() *GameClient {
	baseURL := strings.TrimSpace(os.Getenv("GAME_SERVICE_URL"))
	if baseURL == "" {
		baseURL = strings.TrimSpace(GameServiceURL)
	}
	if baseURL == "" {
		baseURL = "http://game:8081"
	}
	return &GameClient{
		baseURL: baseURL,
		client:  HttpClient,
	}
}

// doRequest is a helper method to execute an HTTP request and return the status code, response body, and any error.
func (gc *GameClient) doRequest(req *http.Request) (int, []byte, error) {
	resp, err := gc.client.Do(req)
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

// ---------- GET ----------
func (gc *GameClient) GetAllGames(query string) (int, []byte, error) {
	url := gc.baseURL + "/games"
	if query != "" {
		url += "?" + query
	}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

func (gc *GameClient) GetPopularGames(query string) (int, []byte, error) {
	url := gc.baseURL + "/games/popular"
	if query != "" {
		url += "?" + query
	}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

func (gc *GameClient) GetGameByID(id string) (int, []byte, error) {
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/games/%s", gc.baseURL, id), nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

// ---------- POST ----------
func (gc *GameClient) CreateGame(body []byte) (int, []byte, error) {
	req, err := http.NewRequest(http.MethodPost, gc.baseURL+"/games", bytes.NewBuffer(body))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return gc.doRequest(req)
}

// ---------- PUT ----------
func (gc *GameClient) UpdateGame(id string, body []byte) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s", gc.baseURL, id)

	req, err := http.NewRequest(http.MethodPut, url, bytes.NewBuffer(body))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	return gc.doRequest(req)
}

// ---------- DELETE ----------
func (gc *GameClient) DeleteGame(id string) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s", gc.baseURL, id)

	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

// ---------- RELATION ROUTES ----------
func (gc *GameClient) GetGamePlatforms(id string) (int, []byte, error) {
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/games/%s/platforms", gc.baseURL, id), nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

func (gc *GameClient) AddGamePlatform(id string, body []byte) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s/platforms", gc.baseURL, id)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return gc.doRequest(req)
}

func (gc *GameClient) RemoveGamePlatform(id, platformID string) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s/platforms/%s", gc.baseURL, id, platformID)
	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

func (gc *GameClient) GetGameKeywords(id string) (int, []byte, error) {
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/games/%s/keywords", gc.baseURL, id), nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

// ---------- KEYWORDS ----------
func (gc *GameClient) AddGameKeyword(id string, body []byte) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s/keywords", gc.baseURL, id)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return gc.doRequest(req)
}

// ---------- KEYWORDS ----------
func (gc *GameClient) RemoveGameKeyword(id, keywordID string) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s/keywords/%s", gc.baseURL, id, keywordID)
	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

// ---------- COMPANIES ----------
func (gc *GameClient) GetGameCompanies(id string) (int, []byte, error) {
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/games/%s/companies", gc.baseURL, id), nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

// ---------- COMPANIES ----------
func (gc *GameClient) AddGameCompany(id string, body []byte) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s/companies", gc.baseURL, id)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return gc.doRequest(req)
}

// ---------- COMPANIES ----------
func (gc *GameClient) RemoveGameCompany(id, companyID string) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s/companies/%s", gc.baseURL, id, companyID)
	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

func (gc *GameClient) GetGameFranchises(id string) (int, []byte, error) {
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/games/%s/franchise", gc.baseURL, id), nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

func (gc *GameClient) AddGameFranchise(id string, body []byte) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s/franchise", gc.baseURL, id)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return gc.doRequest(req)
}

func (gc *GameClient) RemoveGameFranchise(id, franchiseID string) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s/franchise/%s", gc.baseURL, id, franchiseID)
	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

func (gc *GameClient) GetGameSeries(id string) (int, []byte, error) {
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/games/%s/series", gc.baseURL, id), nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

func (gc *GameClient) AddGameSeries(id string, body []byte) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s/series", gc.baseURL, id)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return gc.doRequest(req)
}

func (gc *GameClient) RemoveGameSeries(id, seriesID string) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s/series/%s", gc.baseURL, id, seriesID)
	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}
