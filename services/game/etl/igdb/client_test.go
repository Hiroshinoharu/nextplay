package igdb

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func TestFetchGamesRetriesTimeoutAndSucceeds(t *testing.T) {
	attempts := 0
	client := Client{
		ClientID:    "client-id",
		AccessToken: "access-token",
		HTTPClient: &http.Client{
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				attempts++
				if req.URL.String() != igdbBaseURL+"/games" {
					t.Fatalf("unexpected request URL %q", req.URL.String())
				}
				if req.Header.Get("Client-ID") != "client-id" {
					t.Fatalf("unexpected Client-ID header %q", req.Header.Get("Client-ID"))
				}
				if req.Header.Get("Authorization") != "Bearer access-token" {
					t.Fatalf("unexpected Authorization header %q", req.Header.Get("Authorization"))
				}
				if attempts == 1 {
					return nil, &url.Error{
						Op:  http.MethodPost,
						URL: req.URL.String(),
						Err: context.DeadlineExceeded,
					}
				}

				body, err := io.ReadAll(req.Body)
				if err != nil {
					t.Fatalf("failed to read request body: %v", err)
				}
				query := string(body)
				if !strings.Contains(query, "limit 1; offset 0;") {
					t.Fatalf("unexpected query body %q", query)
				}

				return &http.Response{
					StatusCode: http.StatusOK,
					Header:     make(http.Header),
					Body:       io.NopCloser(strings.NewReader(`[{"id":1,"name":"Halo"}]`)),
				}, nil
			}),
		},
		MaxConcurrent: 1,
		MinInterval:   time.Microsecond,
	}

	games, err := client.FetchGames(1)
	if err != nil {
		t.Fatalf("FetchGames returned error: %v", err)
	}
	if attempts != 2 {
		t.Fatalf("expected 2 attempts, got %d", attempts)
	}
	if len(games) != 1 {
		t.Fatalf("expected 1 game, got %d", len(games))
	}
	if games[0].ID != 1 || games[0].Name != "Halo" {
		t.Fatalf("unexpected game result: %+v", games[0])
	}
}
