package models

import "encoding/json"

// Game represents a video game with its details and relationships
type Game struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	ReleaseDate   string `json:"release_date"`
	Genre         string `json:"genre"`
	Publishers    string `json:"publishers"`
	CoverImageURL string `json:"cover_image"`
	AggregatedRating float64 `json:"aggregated_rating"`
	AggregatedRatingCount int `json:"aggregated_rating_count"`
	TotalRating float64 `json:"total_rating"`
	TotalRatingCount int `json:"total_rating_count"`
	Popularity    float64 `json:"popularity"`
	Story         string `json:"story"`
	Media         []GameMedia `json:"media"`

	// Relationship lists (IDs only)
	Platforms  []int64 `json:"platforms"`
	Keywords   []int64 `json:"keywords"`
	Franchises []int64 `json:"franchises"`
	Companies  []int64 `json:"companies"`
	Series     []int64 `json:"series"`
}

// GameMedia represents media associated with a game
type GameMedia struct {
	IGDBID    int64  `json:"igdb_id"`
	MediaType string `json:"media_type"`
	URL       string `json:"url"`
	SortOrder int    `json:"sort_order"`
}

// Custom JSON marshalling to ensure slices are not nil	
// when serialized to JSON (empty slices instead of null)
func (g Game) MarshalJSON() ([]byte, error) {
	// Create an alias to avoid infinite recursion
	type Alias Game
	alias := Alias(g)
	if alias.Platforms == nil {
		alias.Platforms = []int64{}
	}
	if alias.Keywords == nil {
		alias.Keywords = []int64{}
	}
	if alias.Franchises == nil {
		alias.Franchises = []int64{}
	}
	if alias.Companies == nil {
		alias.Companies = []int64{}
	}
	if alias.Series == nil {
		alias.Series = []int64{}
	}
	if alias.Media == nil {
		alias.Media = []GameMedia{}
	}
	// Marshal the alias to JSON
	return json.Marshal(alias)
}

// ExternalGame represents an external game entry linked to IGDB
type ExternalGame struct {
	ID       int64  `json:"id"`
	GameID   string `json:"game_id"`
	Category string `json:"category"`
}
