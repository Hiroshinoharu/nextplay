package igdb

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

// IGDB API base URL
const igdbBaseURL = "https://api.igdb.com/v4"

// Client represents an IGDB API client
type Client struct {
	ClientID    string
	AccessToken string
	HTTPClient  *http.Client
}


// FetchGames retrieves a list of games from IGDB up to the specified maximum number
func (client Client) FetchGames(maxGames int) ([]Game, error) {
	var games []Game
	limit := 50
	for offset := 0; offset < maxGames; offset += limit {
		if maxGames-offset < limit {
			limit = maxGames - offset
		}
		query := fmt.Sprintf(
			"fields name,summary,first_release_date,genres,platforms,keywords,storyline,cover,involved_companies,artworks,screenshots,videos; limit %d; offset %d; where name != null;",
			limit,
			offset,
		)
		payload, err := client.post("/games", query)
		if err != nil {
			return nil, err
		}

		var batch []Game
		if err := json.Unmarshal(payload, &batch); err != nil {
			return nil, err
		}
		if len(batch) == 0 {
			break
		}
		games = append(games, batch...)
	}
	return games, nil
}

// FetchNamed retrieves named entities (like genres, platforms, keywords) by their IDs
func (client Client) FetchNamed(endpoint string, ids []int) (map[int]string, error) {
	if len(ids) == 0 {
		return map[int]string{}, nil
	}

	result := make(map[int]string, len(ids))
	for _, chunk := range chunkIDs(ids, 200) {
		query := fmt.Sprintf("fields name; where id = (%s); limit %d;", joinIDs(chunk), len(chunk))
		payload, err := client.post(endpoint, query)
		if err != nil {
			return nil, err
		}

		var named []named
		if err := json.Unmarshal(payload, &named); err != nil {
			return nil, err
		}
		for _, item := range named {
			if strings.TrimSpace(item.Name) != "" {
				result[item.ID] = item.Name
			}
		}
	}
	return result, nil
}

// FetchInvolvedCompanies retrieves involved companies by their IDs.
func (client Client) FetchInvolvedCompanies(ids []int) (map[int]InvolvedCompany, error) {
	if len(ids) == 0 {
		return map[int]InvolvedCompany{}, nil
	}

	result := make(map[int]InvolvedCompany, len(ids))
	for _, chunk := range chunkIDs(ids, 200) {
		query := fmt.Sprintf("fields company,publisher,developer; where id = (%s); limit %d;", joinIDs(chunk), len(chunk))
		payload, err := client.post("/involved_companies", query)
		if err != nil {
			return nil, err
		}

		var entries []InvolvedCompany
		if err := json.Unmarshal(payload, &entries); err != nil {
			return nil, err
		}
		for _, item := range entries {
			if item.ID > 0 {
				result[item.ID] = item
			}
		}
	}
	return result, nil
}

// FetchImageIDs retrieves image IDs for a given IGDB image endpoint.
func (client Client) FetchImageIDs(endpoint string, ids []int) (map[int]string, error) {
	if len(ids) == 0 {
		return map[int]string{}, nil
	}

	result := make(map[int]string, len(ids))
	for _, chunk := range chunkIDs(ids, 200) {
		query := fmt.Sprintf("fields image_id; where id = (%s); limit %d;", joinIDs(chunk), len(chunk))
		payload, err := client.post(endpoint, query)
		if err != nil {
			return nil, err
		}

		var covers []cover
		if err := json.Unmarshal(payload, &covers); err != nil {
			return nil, err
		}
		for _, item := range covers {
			if item.ID > 0 && strings.TrimSpace(item.ImageID) != "" {
				result[item.ID] = item.ImageID
			}
		}
	}
	return result, nil
}

// FetchGameVideos retrieves game video entries by their IDs.
func (client Client) FetchGameVideos(ids []int) (map[int]GameVideo, error) {
	if len(ids) == 0 {
		return map[int]GameVideo{}, nil
	}

	result := make(map[int]GameVideo, len(ids))
	for _, chunk := range chunkIDs(ids, 200) {
		query := fmt.Sprintf("fields name,video_id; where id = (%s); limit %d;", joinIDs(chunk), len(chunk))
		payload, err := client.post("/game_videos", query)
		if err != nil {
			return nil, err
		}

		var videos []GameVideo
		if err := json.Unmarshal(payload, &videos); err != nil {
			return nil, err
		}
		for _, item := range videos {
			if item.ID > 0 && strings.TrimSpace(item.VideoID) != "" {
				result[item.ID] = item
			}
		}
	}
	return result, nil
}

// Helper to perform POST requests to IGDB API
func (client Client) post(endpoint, body string) ([]byte, error) {
	req, err := http.NewRequest(http.MethodPost, igdbBaseURL+endpoint, bytes.NewBufferString(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Client-ID", client.ClientID)
	req.Header.Set("Authorization", "Bearer "+client.AccessToken)
	req.Header.Set("Content-Type", "text/plain")

	resp, err := client.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("igdb error: %s", strings.TrimSpace(string(respBody)))
	}
	return respBody, nil
}

// chunkIDs splits a slice of integers into chunks of specified size
func chunkIDs(ids []int, chunkSize int) [][]int {
	// If chunkSize is less than or equal to 0, return the whole slice as one chunk
	if chunkSize <= 0 {
		return [][]int{ids}
	}
	var chunks [][]int
	// Split ids into chunks
	for i := 0; i < len(ids); i += chunkSize {
		end := i + chunkSize
		if end > len(ids) {
			end = len(ids)
		}
		chunks = append(chunks, ids[i:end])
	}
	return chunks
}

// joinIDs converts a slice of integers to a comma-separated string
func joinIDs(ids []int) string {
	parts := make([]string, 0, len(ids))
	for _, id := range ids {
		parts = append(parts, strconv.Itoa(id))
	}
	return strings.Join(parts, ",")
}
