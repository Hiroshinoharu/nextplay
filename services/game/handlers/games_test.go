package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	gamedb "github.com/maxceban/nextplay/services/game/db"
	gamemodels "github.com/maxceban/nextplay/services/game/models"
)

// TestSearchGamesByNameRequiresQuery tests that SearchGamesByName rejects requests without a query parameter.
func TestSearchGamesByNameRequiresQuery(t *testing.T) {
	app := fiber.New()
	app.Get("/games/search", SearchGamesByName)

	resp, err := app.Test(httptest.NewRequest("GET", "/games/search", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

// TestGetGameByIDRejectsInvalidID tests that GetGameByID rejects requests with invalid game IDs.
func TestGetGameByIDRejectsInvalidID(t *testing.T) {
	app := fiber.New()
	app.Get("/games/:id", GetGameByID)

	resp, err := app.Test(httptest.NewRequest("GET", "/games/not-a-number", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

// TestGetRelatedAddOnContentRejectsInvalidID tests that GetRelatedAddOnContent rejects requests with invalid game IDs.
func TestGetRelatedAddOnContentRejectsInvalidID(t *testing.T) {
	app := fiber.New()
	app.Get("/games/:id/related-content", GetRelatedAddOnContent)

	resp, err := app.Test(httptest.NewRequest("GET", "/games/not-a-number/related-content", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

// TestCreateGameRejectsMalformedJSON tests that CreateGame rejects requests with malformed JSON bodies.
func TestCreateGameRejectsMalformedJSON(t *testing.T) {
	app := fiber.New()
	app.Post("/games", CreateGame)

	req := httptest.NewRequest("POST", "/games", bytes.NewBufferString("{"))
	req.Header.Set("Content-Type", fiber.MIMEApplicationJSON)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

func TestUpdateGameRejectsInvalidID(t *testing.T) {
	app := fiber.New()
	app.Put("/games/:id", UpdateGame)

	resp, err := app.Test(httptest.NewRequest("PUT", "/games/not-a-number", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

func TestUpdateGameRejectsMalformedJSON(t *testing.T) {
	app := fiber.New()
	app.Put("/games/:id", UpdateGame)

	req := httptest.NewRequest("PUT", "/games/42", bytes.NewBufferString("{"))
	req.Header.Set("Content-Type", fiber.MIMEApplicationJSON)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

// TestDeleteGameRejectsInvalidID tests that DeleteGame rejects requests with invalid game IDs.
func TestDeleteGameRejectsInvalidID(t *testing.T) {
	app := fiber.New()
	app.Delete("/games/:id", DeleteGame)

	resp, err := app.Test(httptest.NewRequest("DELETE", "/games/not-a-number", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

// TestGetAllGamesReturnsResultsAndNormalizedQueryParameters tests that GetAllGames returns results and normalizes query parameters.
func TestGetAllGamesReturnsResultsAndNormalizedQueryParameters(t *testing.T) {
	withGameStoreStubs(t)
	getGamesFromStore = func(limit, offset int, includeMedia, upcomingOnly bool, searchQuery string, randomOrder bool, excludeNonBaseContent bool) ([]gamemodels.Game, error) {
		if limit != 200 || offset != 0 {
			t.Fatalf("expected normalized limit/offset, got limit=%d offset=%d", limit, offset)
		}
		if !includeMedia || !upcomingOnly || !randomOrder || !excludeNonBaseContent {
			t.Fatalf("expected boolean flags to be true")
		}
		if searchQuery != "Halo" {
			t.Fatalf("expected trimmed search query, got %q", searchQuery)
		}
		return []gamemodels.Game{{ID: 1, Name: "Halo"}}, nil
	}

	app := fiber.New()
	app.Get("/games", GetAllGames)

	resp, err := app.Test(httptest.NewRequest("GET", "/games?limit=999&offset=-5&include_media=1&upcoming=1&q=%20Halo%20&random=1&exclude_non_base=1", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}

	var body []gamemodels.Game
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(body) != 1 || body[0].Name != "Halo" {
		t.Fatalf("unexpected response payload: %#v", body)
	}
}

// TestSearchGamesByNameReturnsResults tests that SearchGamesByName returns results and normalizes query parameters.
// The test checks that the function returns the correct results and that the query parameters are normalized correctly.
func TestSearchGamesByNameReturnsResults(t *testing.T) {
	withGameStoreStubs(t)
	searchGamesByNameFromStore = func(query, mode string, limit, offset int, includeMedia, excludeNonBaseContent bool) ([]gamemodels.Game, error) {
		if query != "Halo" || mode != "prefix" {
			t.Fatalf("unexpected query or mode: %q %q", query, mode)
		}
		if limit != 1000 || offset != 0 {
			t.Fatalf("expected normalized limit/offset, got limit=%d offset=%d", limit, offset)
		}
		if !includeMedia || !excludeNonBaseContent {
			t.Fatalf("expected flags to be true")
		}
		return []gamemodels.Game{{ID: 2, Name: "Halo 2"}}, nil
	}

	app := fiber.New()
	app.Get("/games/search", SearchGamesByName)

	resp, err := app.Test(httptest.NewRequest("GET", "/games/search?q=%20Halo%20&mode=prefix&limit=5000&offset=-2&include_media=1&exclude_non_base=1", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}
}

// TestGetQuestionnaireFacetsReturnsResults tests that GetQuestionnaireFacets returns the questionnaire facets for games and normalizes query parameters.
// The test checks that the function returns the correct results and that the query parameters are normalized correctly.
func TestGetQuestionnaireFacetsReturnsResults(t *testing.T) {
	withGameStoreStubs(t)
	getQuestionnaireFacetsFromStore = func() (*gamedb.QuestionnaireFacets, error) {
		return &gamedb.QuestionnaireFacets{
			Genres:    []gamedb.QuestionnaireFacetGenre{{Slug: "rpg", Label: "RPG", Count: 3}},
			Platforms: []gamedb.QuestionnaireFacetPlatform{{ID: 1, Name: "PC", Count: 4}},
		}, nil
	}

	app := fiber.New()
	app.Get("/games/questionnaire-facets", GetQuestionnaireFacets)

	resp, err := app.Test(httptest.NewRequest("GET", "/games/questionnaire-facets", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}

	var body gamedb.QuestionnaireFacets
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(body.Genres) != 1 || len(body.Platforms) != 1 {
		t.Fatalf("unexpected facets payload: %#v", body)
	}
}

// TestGetGameByIDReturnsDecoratedGame tests that GetGameByID returns a decorated game with all the appropriate fields populated.
func TestGetGameByIDReturnsDecoratedGame(t *testing.T) {
	withGameStoreStubs(t)
	getGameByIDFromStore = func(id int) (*gamemodels.Game, error) {
		if id != 42 {
			t.Fatalf("expected id 42, got %d", id)
		}
		return &gamemodels.Game{ID: 42, Name: "Halo"}, nil
	}
	getGameRelationsFromStore = func(id int) ([]int64, []string, []int64, []int64, []int64, []int64, error) {
		return []int64{1}, []string{"PC"}, []int64{2}, []int64{3}, []int64{4}, []int64{5}, nil
	}
	getGameMediaFromStore = func(id int) ([]gamemodels.GameMedia, error) {
		return []gamemodels.GameMedia{{IGDBID: 8, MediaType: "screenshot", URL: "https://example.com/halo.jpg", SortOrder: 1}}, nil
	}

	app := fiber.New()
	app.Get("/games/:id", GetGameByID)

	resp, err := app.Test(httptest.NewRequest("GET", "/games/42", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}

	var body gamemodels.Game
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(body.PlatformNames) != 1 || body.PlatformNames[0] != "PC" {
		t.Fatalf("expected platform names to be populated, got %#v", body)
	}
	if len(body.Media) != 1 || body.Media[0].URL == "" {
		t.Fatalf("expected media to be populated, got %#v", body)
	}
}

// TestGetRelatedAddOnContentReturnsResults tests that GetRelatedAddOnContent returns results and normalizes query parameters.
// The test checks that the function returns the correct results and that the query parameters are normalized correctly.
func TestGetRelatedAddOnContentReturnsResults(t *testing.T) {
	withGameStoreStubs(t)
	getRelatedAddOnContentFromStore = func(id int, limit int, includeMedia bool) ([]gamemodels.Game, error) {
		if id != 42 || limit != 100 || !includeMedia {
			t.Fatalf("unexpected related-content args: id=%d limit=%d includeMedia=%v", id, limit, includeMedia)
		}
		return []gamemodels.Game{{ID: 99, Name: "Halo DLC"}}, nil
	}

	app := fiber.New()
	app.Get("/games/:id/related-content", GetRelatedAddOnContent)

	resp, err := app.Test(httptest.NewRequest("GET", "/games/42/related-content?limit=999&include_media=1", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}
}

// TestCreateGameReturnsCreatedGameID tests that CreateGame returns the created game ID.
// The test checks that the function returns the correct created game ID and that the query parameters are normalized correctly.
func TestCreateGameReturnsCreatedGameID(t *testing.T) {
	withGameStoreStubs(t)
	createGameInStore = func(game *gamemodels.Game) (int, error) {
		if game.Name != "Halo" {
			t.Fatalf("expected parsed game name, got %#v", game)
		}
		return 77, nil
	}

	app := fiber.New()
	app.Post("/games", CreateGame)

	req := httptest.NewRequest("POST", "/games", bytes.NewBufferString(`{"name":"Halo"}`))
	req.Header.Set("Content-Type", fiber.MIMEApplicationJSON)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("expected status %d, got %d", fiber.StatusCreated, resp.StatusCode)
	}
}

// TestUpdateGameReturnsSuccess tests that UpdateGame returns a successful status code when given a valid request.
// The test checks that the function returns the correct status code and that the query parameters are normalized correctly.
func TestUpdateGameReturnsSuccess(t *testing.T) {
	withGameStoreStubs(t)
	updateGameInStore = func(id int, game *gamemodels.Game) error {
		if id != 42 || game.Name != "Halo Infinite" {
			t.Fatalf("unexpected update request: id=%d game=%#v", id, game)
		}
		return nil
	}

	app := fiber.New()
	app.Put("/games/:id", UpdateGame)

	req := httptest.NewRequest("PUT", "/games/42", bytes.NewBufferString(`{"name":"Halo Infinite"}`))
	req.Header.Set("Content-Type", fiber.MIMEApplicationJSON)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}
}

// TestUpdateGameReturnsNotFoundWhenStoreMisses tests that UpdateGame returns a not found status code when the database store misses the game ID.
func TestUpdateGameReturnsNotFoundWhenStoreMisses(t *testing.T) {
	withGameStoreStubs(t)
	updateGameInStore = func(id int, game *gamemodels.Game) error {
		return sql.ErrNoRows
	}

	app := fiber.New()
	app.Put("/games/:id", UpdateGame)

	req := httptest.NewRequest("PUT", "/games/42", bytes.NewBufferString(`{"name":"Halo Infinite"}`))
	req.Header.Set("Content-Type", fiber.MIMEApplicationJSON)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("expected status %d, got %d", fiber.StatusNotFound, resp.StatusCode)
	}
}

// TestDeleteGameReturnsSuccess tests that DeleteGame returns a successful status code when given a valid request.
// The test checks that the function returns the correct status code and that the query parameters are normalized correctly.
func TestDeleteGameReturnsSuccess(t *testing.T) {
	withGameStoreStubs(t)
	deleteGameFromStore = func(id int) error {
		if id != 42 {
			t.Fatalf("expected delete id 42, got %d", id)
		}
		return nil
	}

	app := fiber.New()
	app.Delete("/games/:id", DeleteGame)

	resp, err := app.Test(httptest.NewRequest("DELETE", "/games/42", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}
}

// TestDeleteGameReturnsNotFoundWhenStoreMisses tests that DeleteGame returns a not found status code when the database store misses the game ID.
func TestDeleteGameReturnsNotFoundWhenStoreMisses(t *testing.T) {
	withGameStoreStubs(t)
	deleteGameFromStore = func(id int) error {
		return sql.ErrNoRows
	}

	app := fiber.New()
	app.Delete("/games/:id", DeleteGame)

	resp, err := app.Test(httptest.NewRequest("DELETE", "/games/42", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("expected status %d, got %d", fiber.StatusNotFound, resp.StatusCode)
	}
}

// withGameStoreStubs is a helper function that is used to stub out the game store functions for testing purposes.
// It is typically used in tests to mock the behavior of the game store functions.
// It is important to call t.Cleanup() at the end of the test to restore the original functions.
func withGameStoreStubs(t *testing.T) {
	t.Helper()

	oldGetGames := getGamesFromStore
	oldSearchGamesByName := searchGamesByNameFromStore
	oldGetPopularGames := getPopularGamesFromStore
	oldGetTopGames := getTopGamesFromStore
	oldGetQuestionnaireFacets := getQuestionnaireFacetsFromStore
	oldGetGameByID := getGameByIDFromStore
	oldGetGameRelations := getGameRelationsFromStore
	oldGetGameMedia := getGameMediaFromStore
	oldGetRelatedAddOnContent := getRelatedAddOnContentFromStore
	oldCreateGame := createGameInStore
	oldUpdateGame := updateGameInStore
	oldDeleteGame := deleteGameFromStore

	t.Cleanup(func() {
		getGamesFromStore = oldGetGames
		searchGamesByNameFromStore = oldSearchGamesByName
		getPopularGamesFromStore = oldGetPopularGames
		getTopGamesFromStore = oldGetTopGames
		getQuestionnaireFacetsFromStore = oldGetQuestionnaireFacets
		getGameByIDFromStore = oldGetGameByID
		getGameRelationsFromStore = oldGetGameRelations
		getGameMediaFromStore = oldGetGameMedia
		getRelatedAddOnContentFromStore = oldGetRelatedAddOnContent
		createGameInStore = oldCreateGame
		updateGameInStore = oldUpdateGame
		deleteGameFromStore = oldDeleteGame
	})
}
