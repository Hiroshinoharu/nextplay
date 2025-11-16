package clients

import (
    "fmt"
    "net/http"
    "io"
    "bytes"
)

type GameClient struct {
    baseURL string
}

func NewGameClient() *GameClient {
    return &GameClient{
        baseURL: "http://game:8081",
    }
}

// ---------- GET ----------
func (gc *GameClient) GetAllGames() ([]byte, error) {
    resp, err := http.Get(gc.baseURL + "/games")
    if err != nil { return nil, err }
    return io.ReadAll(resp.Body)
}

func (gc *GameClient) GetGameByID(id string) ([]byte, error) {
    resp, err := http.Get(fmt.Sprintf("%s/games/%s", gc.baseURL, id))
    if err != nil { return nil, err }
    return io.ReadAll(resp.Body)
}

// ---------- POST ----------
func (gc *GameClient) CreateGame(body []byte) ([]byte, error) {
    resp, err := http.Post(gc.baseURL+"/games", "application/json", bytes.NewBuffer(body))
    if err != nil { return nil, err }
    return io.ReadAll(resp.Body)
}

// ---------- PUT ----------
func (gc *GameClient) UpdateGame(id string, body []byte) ([]byte, error) {
    url := fmt.Sprintf("%s/games/%s", gc.baseURL, id)

    req, _ := http.NewRequest(http.MethodPut, url, bytes.NewBuffer(body))
    req.Header.Set("Content-Type", "application/json")

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil { return nil, err }

    return io.ReadAll(resp.Body)
}

// ---------- DELETE ----------
func (gc *GameClient) DeleteGame(id string) ([]byte, error) {
    url := fmt.Sprintf("%s/games/%s", gc.baseURL, id)

    req, _ := http.NewRequest(http.MethodDelete, url, nil)
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil { return nil, err }

    return io.ReadAll(resp.Body)
}

// ---------- RELATION ROUTES ----------
func (gc *GameClient) GetGamePlatforms(id string) ([]byte, error) {
    resp, err := http.Get(fmt.Sprintf("%s/games/%s/platforms", gc.baseURL, id))
    if err != nil { return nil, err }
    return io.ReadAll(resp.Body)
}

func (gc *GameClient) AddGamePlatform(id string, body []byte) ([]byte, error) {
    url := fmt.Sprintf("%s/games/%s/platforms", gc.baseURL, id)
    resp, err := http.Post(url, "application/json", bytes.NewBuffer(body))
    if err != nil { return nil, err }
    return io.ReadAll(resp.Body)
}

func (gc *GameClient) RemoveGamePlatform(id, platformID string) ([]byte, error) {
    url := fmt.Sprintf("%s/games/%s/platforms/%s", gc.baseURL, id, platformID)
    req, _ := http.NewRequest(http.MethodDelete, url, nil)
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil { return nil, err }
    return io.ReadAll(resp.Body)
}

func (gc *GameClient) GetGameKeywords(id string) ([]byte, error) {
    resp, err := http.Get(fmt.Sprintf("%s/games/%s/keywords", gc.baseURL, id))
    if err != nil { return nil, err }
    return io.ReadAll(resp.Body)
}

func (gc *GameClient) AddGameKeyword(id string, body []byte) ([]byte, error) {
    url := fmt.Sprintf("%s/games/%s/keywords", gc.baseURL, id)
    resp, err := http.Post(url, "application/json", bytes.NewBuffer(body))
    if err != nil { return nil, err }
    return io.ReadAll(resp.Body)
}

func (gc *GameClient) RemoveGameKeyword(id, keywordID string) ([]byte, error) {
    url := fmt.Sprintf("%s/games/%s/keywords/%s", gc.baseURL, id, keywordID)
    req, _ := http.NewRequest(http.MethodDelete, url, nil)
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil { return nil, err }
    return io.ReadAll(resp.Body)
}

func (gc *GameClient) GetGameCompanies(id string) ([]byte, error) {
    resp, err := http.Get(fmt.Sprintf("%s/games/%s/companies", gc.baseURL, id))
    if err != nil { return nil, err }
    return io.ReadAll(resp.Body)
}

func (gc *GameClient) AddGameCompany(id string, body []byte) ([]byte, error) {
    url := fmt.Sprintf("%s/games/%s/companies", gc.baseURL, id)
    resp, err := http.Post(url, "application/json", bytes.NewBuffer(body))
    if err != nil { return nil, err }
    return io.ReadAll(resp.Body)
}

func (gc *GameClient) RemoveGameCompany(id, companyID string) ([]byte, error) {
    url := fmt.Sprintf("%s/games/%s/companies/%s", gc.baseURL, id, companyID)
    req, _ := http.NewRequest(http.MethodDelete, url, nil)
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil { return nil, err }
    return io.ReadAll(resp.Body)
}

func (gc *GameClient) GetGameFranchises(id string) ([]byte, error) {
    resp, err := http.Get(fmt.Sprintf("%s/games/%s/franchise", gc.baseURL, id))
    if err != nil { return nil, err }
    return io.ReadAll(resp.Body)
}

func (gc *GameClient) AddGameFranchise(id string, body []byte) ([]byte, error) {
    url := fmt.Sprintf("%s/games/%s/franchise", gc.baseURL, id)
    resp, err := http.Post(url, "application/json", bytes.NewBuffer(body))
    if err != nil { return nil, err }
    return io.ReadAll(resp.Body)
}

func (gc *GameClient) RemoveGameFranchise(id, franchiseID string) ([]byte, error) {
    url := fmt.Sprintf("%s/games/%s/franchise/%s", gc.baseURL, id, franchiseID)
    req, _ := http.NewRequest(http.MethodDelete, url, nil)
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil { return nil, err }
    return io.ReadAll(resp.Body)
}

func (gc *GameClient) GetGameSeries(id string) ([]byte, error) {
    resp, err := http.Get(fmt.Sprintf("%s/games/%s/series", gc.baseURL, id))
    if err != nil { return nil, err }
    return io.ReadAll(resp.Body)
}

func (gc *GameClient) AddGameSeries(id string, body []byte) ([]byte, error) {
    url := fmt.Sprintf("%s/games/%s/series", gc.baseURL, id)
    resp, err := http.Post(url, "application/json", bytes.NewBuffer(body))
    if err != nil { return nil, err }
    return io.ReadAll(resp.Body)
}

func (gc *GameClient) RemoveGameSeries(id, seriesID string) ([]byte, error) {
    url := fmt.Sprintf("%s/games/%s/series/%s", gc.baseURL, id, seriesID)
    req, _ := http.NewRequest(http.MethodDelete, url, nil)
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil { return nil, err }
    return io.ReadAll(resp.Body)
}
