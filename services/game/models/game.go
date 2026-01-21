package models

import "encoding/json"

type Game struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	ReleaseDate   string `json:"release_date"`
	Genre         string `json:"genre"`
	Publishers    string `json:"publishers"`
	CoverImageURL string `json:"cover_image"`
	Story         string `json:"story"`

	// Relationship lists (IDs only)
	Platforms  []int64 `json:"platforms"`
	Keywords   []int64 `json:"keywords"`
	Franchises []int64 `json:"franchises"`
	Companies  []int64 `json:"companies"`
	Series     []int64 `json:"series"`
}

func (g Game) MarshalJSON() ([]byte, error) {
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
	return json.Marshal(alias)
}
