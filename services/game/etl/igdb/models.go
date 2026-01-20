package igdb

// Game represents a game fetched from the IGDB API
type Game struct {
	ID               int    `json:"id"`
	Name             string `json:"name"`
	Summary          string `json:"summary"`
	Storyline        string `json:"storyline"`
	FirstReleaseDate int64  `json:"first_release_date"`
	Genres           []int  `json:"genres"`
	Platforms        []int  `json:"platforms"`
	Keywords         []int  `json:"keywords"`
}

// named represents a generic named entity from IGDB
type named struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}
