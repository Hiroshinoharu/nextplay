package clients

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

// GameClient wraps outbound calls from the gateway to the game service.
type GameClient struct {
	baseURL string
	client  *http.Client
	headers map[string]string
}

// NewGameClient returns a new GameClient instance with the base URL set to the
// environment variable GAME_SERVICE_URL, or the default value if it is not set.
// The client is configured with the same HTTP client as the default client.
// The returned client is ready to use and does not require any additional configuration.
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

// NewGameClientWithHeaders creates a new GameClient instance with the given HTTP headers.
// It's useful for creating a client that forwards specific headers to the Game service.
// The returned client is configured with the same base URL as the default client.
func NewGameClientWithHeaders(headers map[string]string) *GameClient {
	client := NewGameClient()
	client.headers = headers
	return client
}

// doRequest is a helper method to execute an HTTP request and return the status code, response body, and any error.
func (gc *GameClient) doRequest(req *http.Request) (int, []byte, error) {
	for key, value := range gc.headers {
		req.Header.Set(key, value)
	}

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

// SearchGamesByName returns a list of games that match the given query string.
// The query string can include game name, genre, or keywords.
// The result is a list of games in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func (gc *GameClient) SearchGamesByName(query string) (int, []byte, error) {
	url := gc.baseURL + "/games/search"
	if query != "" {
		url += "?" + query
	}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

// GetPopularGames returns a list of popular games based on the given query string.
// The query string can include the following parameters:
//   - year: the release year of the games to include in the result
//   - limit: the maximum number of games to return
//   - offset: the number of games to skip before returning the result
//   - min_rating_count: the minimum number of ratings required for a game to be included in the result
//   - include_media: whether to include media (e.g. images, videos) in the response
// The result is a list of games in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
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

// GetTopGames returns a list of top games based on the given query string.
// The query string can include the following parameters:
//   - limit: the maximum number of games to return
//   - offset: the number of games to skip before returning the result
//   - min_rating_count: the minimum number of ratings required for a game to be included in the result
//   - include_media: whether to include media (e.g. images, videos) in the response
// The result is a list of games in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func (gc *GameClient) GetTopGames(query string) (int, []byte, error) {
	url := gc.baseURL + "/games/top"
	if query != "" {
		url += "?" + query
	}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

// GetQuestionnaireFacets returns a list of questionnaire facets in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func (gc *GameClient) GetQuestionnaireFacets() (int, []byte, error) {
	req, err := http.NewRequest(http.MethodGet, gc.baseURL+"/games/questionnaire-facets", nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

// GetGameByID returns a game by the given ID in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func (gc *GameClient) GetGameByID(id string) (int, []byte, error) {
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/games/%s", gc.baseURL, id), nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

// GetRelatedAddOnContent returns a list of related games to the given game ID in JSON format.
// The query string can include the following parameters:
//   - limit: the maximum number of games to return
//   - offset: the number of games to skip before returning the result
//   - min_rating_count: the minimum number of ratings required for a game to be included in the result
//   - include_media: whether to include media (e.g. images, videos) in the response
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func (gc *GameClient) GetRelatedAddOnContent(id, query string) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s/related-content", gc.baseURL, id)
	if query != "" {
		url += "?" + query
	}
	req, err := http.NewRequest(http.MethodGet, url, nil)
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

// AddGamePlatform adds a platform to a game by the given ID.
// The request body should contain the platform ID in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func (gc *GameClient) AddGamePlatform(id string, body []byte) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s/platforms", gc.baseURL, id)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return gc.doRequest(req)
}

// RemoveGamePlatform removes a platform from a game by the given ID.
// The request body should be empty.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func (gc *GameClient) RemoveGamePlatform(id, platformID string) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s/platforms/%s", gc.baseURL, id, platformID)
	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

// GetGameKeywords returns a list of keywords for a game by the given ID in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
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

// GetGameFranchises returns a list of franchises associated with a game by the given ID in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func (gc *GameClient) GetGameFranchises(id string) (int, []byte, error) {
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/games/%s/franchise", gc.baseURL, id), nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

// AddGameFranchise adds a franchise to a game by the given ID.
// The request body should contain the franchise ID in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func (gc *GameClient) AddGameFranchise(id string, body []byte) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s/franchise", gc.baseURL, id)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return gc.doRequest(req)
}

// RemoveGameFranchise removes a franchise from a game by the given ID.
// The request body should be empty.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func (gc *GameClient) RemoveGameFranchise(id, franchiseID string) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s/franchise/%s", gc.baseURL, id, franchiseID)
	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

// GetGameSeries returns a list of series associated with a game by the given ID in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func (gc *GameClient) GetGameSeries(id string) (int, []byte, error) {
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/games/%s/series", gc.baseURL, id), nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}

// AddGameSeries adds a series to a game by the given ID.
// The request body should contain the series ID in JSON format.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func (gc *GameClient) AddGameSeries(id string, body []byte) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s/series", gc.baseURL, id)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return gc.doRequest(req)
}

// RemoveGameSeries removes a series from a game by the given ID.
// The request body should be empty.
// The returned status code is the HTTP status code from the Game service.
// The returned error is nil if the request is successful, or an error if there is an issue with the request.
func (gc *GameClient) RemoveGameSeries(id, seriesID string) (int, []byte, error) {
	url := fmt.Sprintf("%s/games/%s/series/%s", gc.baseURL, id, seriesID)
	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return 0, nil, err
	}
	return gc.doRequest(req)
}
