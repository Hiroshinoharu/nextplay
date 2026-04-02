package db

import (
	"errors"
	"testing"
	"time"
)

// TestGetQuestionnaireFacetsCachesResults tests that GetQuestionnaireFacets caches questionnaire facets and returns a cloned value from the cache.
func TestGetQuestionnaireFacetsCachesResults(t *testing.T) {
	restore := snapshotQuestionnaireFacetsCacheState()
	defer restore()

	now := time.Date(2026, time.March, 27, 15, 30, 0, 0, time.UTC)
	questionnaireFacetsTimeNow = func() time.Time { return now }

	loadCalls := 0
	questionnaireFacetsLoader = func() (*QuestionnaireFacets, error) {
		loadCalls++
		return &QuestionnaireFacets{
			Genres:    []QuestionnaireFacetGenre{{Slug: "rpg", Label: "RPG", Count: 10}},
			Platforms: []QuestionnaireFacetPlatform{{ID: 1, Name: "PC", Count: 20}},
		}, nil
	}

	first, err := GetQuestionnaireFacets()
	if err != nil {
		t.Fatalf("GetQuestionnaireFacets returned error: %v", err)
	}
	first.Genres[0].Label = "mutated"

	second, err := GetQuestionnaireFacets()
	if err != nil {
		t.Fatalf("second GetQuestionnaireFacets returned error: %v", err)
	}

	if loadCalls != 1 {
		t.Fatalf("expected loader to be called once, got %d", loadCalls)
	}
	if second.Genres[0].Label != "RPG" {
		t.Fatalf("expected cached value to be cloned, got %#v", second.Genres)
	}
}

func TestGetQuestionnaireFacetsFallsBackToStaleCacheOnError(t *testing.T) {
	restore := snapshotQuestionnaireFacetsCacheState()
	defer restore()

	initialTime := time.Date(2026, time.March, 27, 15, 30, 0, 0, time.UTC)
	currentTime := initialTime
	questionnaireFacetsTimeNow = func() time.Time { return currentTime }

	questionnaireFacetsLoader = func() (*QuestionnaireFacets, error) {
		return &QuestionnaireFacets{
			Genres:    []QuestionnaireFacetGenre{{Slug: "strategy", Label: "Strategy", Count: 6}},
			Platforms: []QuestionnaireFacetPlatform{{ID: 6, Name: "Linux", Count: 2}},
		}, nil
	}

	if _, err := GetQuestionnaireFacets(); err != nil {
		t.Fatalf("priming cache failed: %v", err)
	}

	currentTime = initialTime.Add(questionnaireFacetsCacheTTL + time.Minute)
	questionnaireFacetsLoader = func() (*QuestionnaireFacets, error) {
		return nil, errors.New("database unavailable")
	}

	facets, err := GetQuestionnaireFacets()
	if err != nil {
		t.Fatalf("expected stale cache fallback, got error: %v", err)
	}
	if len(facets.Genres) != 1 || facets.Genres[0].Label != "Strategy" {
		t.Fatalf("unexpected stale facets payload: %#v", facets)
	}
}

func snapshotQuestionnaireFacetsCacheState() func() {
	questionnaireFacetsCacheMu.Lock()
	oldValue := cloneQuestionnaireFacets(questionnaireFacetsCacheValue)
	oldExpiry := questionnaireFacetsCacheExpiry
	oldLoader := questionnaireFacetsLoader
	oldNow := questionnaireFacetsTimeNow
	questionnaireFacetsCacheValue = nil
	questionnaireFacetsCacheExpiry = time.Time{}
	questionnaireFacetsCacheMu.Unlock()

	return func() {
		questionnaireFacetsCacheMu.Lock()
		questionnaireFacetsCacheValue = oldValue
		questionnaireFacetsCacheExpiry = oldExpiry
		questionnaireFacetsLoader = oldLoader
		questionnaireFacetsTimeNow = oldNow
		questionnaireFacetsCacheMu.Unlock()
	}
}
