package igdb

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// IGDB API base URL
const igdbBaseURL = "https://api.igdb.com/v4"

// Client represents an IGDB API client
type Client struct {
	ClientID    string
	AccessToken string
	HTTPClient  *http.Client

	// Optional throttling controls to avoid IGDB rate limiting.
	MaxConcurrent int
	MinInterval   time.Duration

	// internal fields for rate limiting
	limiterOnce sync.Once
	semaphore   chan struct{}
	ticker      *time.Ticker
}

func (client *Client) initLimiter() {
	maxConcurrent := client.MaxConcurrent
	if maxConcurrent <= 0 {
		maxConcurrent = 2
	}
	minInterval := client.MinInterval
	if minInterval <= 0 {
		minInterval = 250 * time.Millisecond
	}
	client.semaphore = make(chan struct{}, maxConcurrent)
	if minInterval > 0 {
		client.ticker = time.NewTicker(minInterval)
	}
}

func (client *Client) acquire() func() {
	client.limiterOnce.Do(client.initLimiter)
	if client.semaphore != nil {
		client.semaphore <- struct{}{}
	}
	if client.ticker != nil {
		<-client.ticker.C
	}
	return func() {
		if client.semaphore != nil {
			<-client.semaphore
		}
	}
}

// FetchGames retrieves a list of games from IGDB up to the specified maximum number
func (client *Client) FetchGames(maxGames int) ([]Game, error) {
	var games []Game
	limit := 50
	for offset := 0; ; offset += limit {
		pageLimit := limit
		if maxGames > 0 {
			if offset >= maxGames {
				break
			}
			if maxGames-offset < pageLimit {
				pageLimit = maxGames - offset
			}
		}
		if pageLimit <= 0 {
			break
		}
		query := fmt.Sprintf(
			"fields name,summary,first_release_date,aggregated_rating,aggregated_rating_count,total_rating,total_rating_count,genres,platforms,keywords,storyline,cover,involved_companies,external_games,artworks,screenshots,videos; limit %d; offset %d; where name != null;",
			pageLimit,
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
		if maxGames > 0 && len(games) >= maxGames {
			break
		}
	}
	return games, nil
}

// FetchGamesByIDs retrieves game details for specific IGDB IDs.
func (client *Client) FetchGamesByIDs(ids []int) ([]Game, error) {
	if len(ids) == 0 {
		return []Game{}, nil
	}
	var games []Game
	for _, chunk := range chunkIDs(ids, 200) {
		query := fmt.Sprintf(
			"fields name,summary,first_release_date,aggregated_rating,aggregated_rating_count,total_rating,total_rating_count,genres,platforms,keywords,franchises, collections,storyline,cover,involved_companies,external_games,artworks,screenshots,videos; where id = (%s); limit %d;",
			joinIDs(chunk),
			len(chunk),
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
			continue
		}
		games = append(games, batch...)
	}
	return games, nil
}

// FetchExternalGames retrieves external game entries by their IDs.
func (client *Client) FetchExternalGames(ids []int) (map[int]ExternalGame, error){
	if len(ids) == 0 {
		return map[int]ExternalGame{}, nil
	}

	result := make(map[int]ExternalGame, len(ids))
	for _,chunks := range chunkIDs(ids, 200){
		query := fmt.Sprintf("fields game,category; where id = (%s); limit %d;", joinIDs(chunks), len(chunks))
		payload, err := client.post("/external_games", query)
		if err != nil {
			return nil, err
		}

		var entries []ExternalGame
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

// FetchPopularityPrimitives retrieves PopScore popularity for the provided game IDs and popularity type.
func (client *Client) FetchPopularityPrimitives(gameIDs []int, popularityType int) (map[int]float64, error) {
	if len(gameIDs) == 0 {
		return map[int]float64{}, nil
	}
	if popularityType <= 0 {
		popularityType = 1
	}

	result := make(map[int]float64, len(gameIDs))
	for _, chunk := range chunkIDs(gameIDs, 200) {
		query := fmt.Sprintf(
			"fields game_id,value,popularity_type; where game_id = (%s) & popularity_type = %d; limit %d;",
			joinIDs(chunk),
			popularityType,
			len(chunk),
		)
		payload, err := client.post("/popularity_primitives", query)
		if err != nil {
			return nil, err
		}

		var entries []PopularityPrimitive
		if err := json.Unmarshal(payload, &entries); err != nil {
			return nil, err
		}
		for _, item := range entries {
			if item.GameID <= 0 || item.Value <= 0 {
				continue
			}
			result[item.GameID] = item.Value
		}
	}
	return result, nil
}

// FetchTopPopularityGameIDs retrieves the top game IDs by PopScore popularity.
func (client *Client) FetchTopPopularityGameIDs(limit int, popularityType int) ([]int, map[int]float64, error) {
	if limit <= 0 {
		return []int{}, map[int]float64{}, nil
	}
	if popularityType <= 0 {
		popularityType = 1
	}

	result := make([]int, 0, limit)
	values := make(map[int]float64, limit)
	seen := make(map[int]struct{}, limit)
	pageSize := 500
	for offset := 0; offset < limit; offset += pageSize {
		pageLimit := pageSize
		if limit-offset < pageLimit {
			pageLimit = limit - offset
		}
		query := fmt.Sprintf(
			"fields game_id,value,popularity_type; where popularity_type = %d; sort value desc; limit %d; offset %d;",
			popularityType,
			pageLimit,
			offset,
		)
		payload, err := client.post("/popularity_primitives", query)
		if err != nil {
			return nil, nil, err
		}
		var entries []PopularityPrimitive
		if err := json.Unmarshal(payload, &entries); err != nil {
			return nil, nil, err
		}
		if len(entries) == 0 {
			break
		}
		for _, item := range entries {
			if item.GameID <= 0 {
				continue
			}
			if _, exists := seen[item.GameID]; exists {
				continue
			}
			seen[item.GameID] = struct{}{}
			result = append(result, item.GameID)
			if item.Value > 0 {
				values[item.GameID] = item.Value
			}
			if len(result) >= limit {
				break
			}
		}
		if len(result) >= limit {
			break
		}
	}
	return result, values, nil
}

// FetchAllPopularityGameIDs retrieves all game IDs for a PopScore popularity type.
// Use maxIDs or maxPages to cap the size (0 means no cap).
func (client *Client) FetchAllPopularityGameIDs(popularityType, maxIDs, maxPages int) ([]int, map[int]float64, error) {
	if popularityType <= 0 {
		popularityType = 1
	}
	pageSize := 500
	result := make([]int, 0, pageSize)
	values := make(map[int]float64, pageSize)
	seen := make(map[int]struct{}, pageSize)

	for page := 0; ; page++ {
		if maxPages > 0 && page >= maxPages {
			break
		}
		if maxIDs > 0 && len(result) >= maxIDs {
			break
		}

		limit := pageSize
		if maxIDs > 0 && maxIDs-len(result) < limit {
			limit = maxIDs - len(result)
		}
		if limit <= 0 {
			break
		}

		query := fmt.Sprintf(
			"fields game_id,value,popularity_type; where popularity_type = %d; sort value desc; limit %d; offset %d;",
			popularityType,
			limit,
			page*pageSize,
		)
		payload, err := client.post("/popularity_primitives", query)
		if err != nil {
			return nil, nil, err
		}

		var entries []PopularityPrimitive
		if err := json.Unmarshal(payload, &entries); err != nil {
			return nil, nil, err
		}
		if len(entries) == 0 {
			break
		}

		for _, item := range entries {
			if item.GameID <= 0 {
				continue
			}
			if _, exists := seen[item.GameID]; exists {
				continue
			}
			seen[item.GameID] = struct{}{}
			result = append(result, item.GameID)
			if item.Value > 0 {
				values[item.GameID] = item.Value
			}
		}
	}

	return result, values, nil
}

// FetchNamed retrieves named entities (like genres, platforms, keywords) by their IDs
func (client *Client) FetchNamed(endpoint string, ids []int) (map[int]string, error) {
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
func (client *Client) FetchInvolvedCompanies(ids []int) (map[int]InvolvedCompany, error) {
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
func (client *Client) FetchImageIDs(endpoint string, ids []int) (map[int]string, error) {
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
func (client *Client) FetchGameVideos(ids []int) (map[int]GameVideo, error) {
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
func (client *Client) post(endpoint, body string) ([]byte, error) {
	const maxRetries = 4
	backoff := 250 * time.Millisecond
	httpClient := client.HTTPClient
	if httpClient == nil {
		httpClient = http.DefaultClient
	}

	for attempt := 0; attempt <= maxRetries; attempt++ {
		req, err := http.NewRequest(http.MethodPost, igdbBaseURL+endpoint, bytes.NewBufferString(body))
		if err != nil {
			return nil, err
		}

		// Set required headers
		req.Header.Set("Client-ID", client.ClientID)
		req.Header.Set("Authorization", "Bearer "+client.AccessToken)
		req.Header.Set("Content-Type", "text/plain")

		// Execute the request
		release := client.acquire()
		resp, err := httpClient.Do(req)
		release()
		if err != nil {
			return nil, err
		}
		// Read and close the response body
		respBody, readErr := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if readErr != nil {
			return nil, readErr
		}

		// Handle rate limiting
		if resp.StatusCode == http.StatusTooManyRequests {
			if attempt == maxRetries {
				return nil, fmt.Errorf("igdb error: %s", strings.TrimSpace(string(respBody)))
			}
			// Determine wait t
			// Time before retrying
			delay := backoff
			if retryAfter := strings.TrimSpace(resp.Header.Get("Retry-After")); retryAfter != "" {
				if seconds, err := strconv.Atoi(retryAfter); err == nil && seconds > 0 {
					delay = time.Duration(seconds) * time.Second
				} else if when, err := http.ParseTime(retryAfter); err == nil {
					if until := time.Until(when); until > 0 {
						delay = until
					}
				}
			} else if reset := strings.TrimSpace(resp.Header.Get("X-RateLimit-Reset")); reset != "" {
				if resetAt, err := strconv.ParseInt(reset, 10, 64); err == nil && resetAt > 0 {
					var resetTime time.Time
					if resetAt > 1_000_000_000_000 {
						resetTime = time.UnixMilli(resetAt)
					} else {
						resetTime = time.Unix(resetAt, 0)
					}
					if until := time.Until(resetTime); until > 0 {
						delay = until
					}
				}
			}
			time.Sleep(delay)
			backoff *= 2
			if backoff > 5*time.Second {
				backoff = 5 * time.Second
			}
			continue
		}

		if resp.StatusCode >= 300 {
			return nil, fmt.Errorf("igdb error: %s", strings.TrimSpace(string(respBody)))
		}
		return respBody, nil
	}

	return nil, fmt.Errorf("igdb error: exhausted retries")
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
