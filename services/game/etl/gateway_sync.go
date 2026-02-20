package main

import (
	"bytes"
	"errors"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// This file contains logic for synchronizing game data to the Gateway service after upserting in the Game service.
type gatewaySyncClient struct {
	baseURL      string
	serviceToken string
	httpClient   *http.Client
}

// newGatewaySyncClient initializes a new client for communicating with the Gateway service.
func newGatewaySyncClient(baseURL, serviceToken string) *gatewaySyncClient {
	return &gatewaySyncClient{
		baseURL:      strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		serviceToken: strings.TrimSpace(serviceToken),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// putGame sends a PUT request to the Gateway service to update game details for the specified game ID.
func (c *gatewaySyncClient) putGame(gameID int, row gameUpsertRow) error {
	payload := map[string]any{
		"name":         row.Name,
		"description":  derefString(row.Description),
		"release_date": derefString(row.ReleaseDate),
		"genre":        derefString(row.Genre),
		"publishers":   derefString(row.Publishers),
		"story":        derefString(row.Story),
		"cover_image":  derefString(row.CoverImageURL),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal game payload: %w", err)
	}

	baseURLs := []string{c.baseURL}
	if fallback := localhostFallbackBaseURL(c.baseURL); fallback != "" && fallback != c.baseURL {
		baseURLs = append(baseURLs, fallback)
	}

	// Attempt to send the update to the Gateway service, trying the primary base URL first and falling back to localhost if a DNS error occurs.
	var lastErr error
	for idx, baseURL := range baseURLs {
		targetURL := fmt.Sprintf("%s/api/games/%d", baseURL, gameID)
		req, err := http.NewRequest(http.MethodPut, targetURL, bytes.NewReader(body))
		if err != nil {
			return fmt.Errorf("build request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Service-Token", c.serviceToken)

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			// Retry only for DNS lookup failures on the first base URL.
			if idx == 0 && isNoSuchHostErr(err) {
				continue
			}
			return fmt.Errorf("gateway request failed: %w", err)
		}

		if resp.StatusCode >= http.StatusBadRequest {
			data, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
			_ = resp.Body.Close()
			return fmt.Errorf("gateway returned %d: %s", resp.StatusCode, strings.TrimSpace(string(data)))
		}
		_ = resp.Body.Close()
		return nil
	}

	return fmt.Errorf("gateway request failed: %w", lastErr)
}

// syncGamesViaGateway iterates over the provided game rows and sends updates to the Gateway service for each game that has a valid mapping in gameIDByIGDB.
func syncGamesViaGateway(client *gatewaySyncClient, gameRows []gameUpsertRow, gameIDByIGDB map[int]int, limit int) error {
	if client == nil {
		return fmt.Errorf("gateway client is nil")
	}
	if len(gameRows) == 0 {
		return nil
	}

	target := len(gameRows)
	if limit > 0 && limit < target {
		target = limit
	}

	for idx := 0; idx < target; idx++ {
		row := gameRows[idx]
		gameID, ok := gameIDByIGDB[row.IGDBID]
		if !ok || gameID <= 0 {
			continue
		}
		if err := client.putGame(gameID, row); err != nil {
			return fmt.Errorf("sync game_id=%d igdb_id=%d: %w", gameID, row.IGDBID, err)
		}
	}

	return nil
}

// shouldSyncViaGateway checks the environment variable ETL_GATEWAY_WRITE_ENABLED to determine if synchronization to the Gateway service is enabled.
func shouldSyncViaGateway() bool {
	raw := strings.TrimSpace(os.Getenv("ETL_GATEWAY_WRITE_ENABLED"))
	return raw == "1" || strings.EqualFold(raw, "true")
}

// gatewayWriteLimit retrieves the maximum number of games to synchronize to the Gateway service from the ETL_GATEWAY_WRITE_LIMIT environment variable. A value of 0 means no limit.
func gatewayWriteLimit() int {
	raw := strings.TrimSpace(os.Getenv("ETL_GATEWAY_WRITE_LIMIT"))
	if raw == "" {
		return 0
	}
	val, err := strconv.Atoi(raw)
	if err != nil || val < 0 {
		return 0
	}
	return val
}

// derefString safely dereferences a string pointer, returning an empty string if the pointer is nil or points to whitespace.
func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

// localhostFallbackBaseURL checks if the provided base URL is using a hostname that matches "gateway" (case-insensitive). 
// If so, it constructs and returns a fallback URL that replaces the hostname with "localhost" while preserving the port. 
// If the base URL does not match the expected pattern or cannot be parsed, an empty string is returned.
func localhostFallbackBaseURL(baseURL string) string {
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return ""
	}
	if !strings.EqualFold(parsed.Hostname(), "gateway") {
		return ""
	}
	port := parsed.Port()
	if port == "" {
		return ""
	}
	parsed.Host = "localhost:" + port
	return strings.TrimRight(parsed.String(), "/")
}

// isNoSuchHostErr checks if the provided error is a DNS error indicating that the host could not be found. 
// It uses errors.As to check if the error can be cast to a *net.DNSError and then checks the IsNotFound field to determine if it is a "no such host" error.
func isNoSuchHostErr(err error) bool {
	var dnsErr *net.DNSError
	return errors.As(err, &dnsErr) && dnsErr.IsNotFound
}
