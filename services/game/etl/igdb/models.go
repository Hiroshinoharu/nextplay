package igdb

// Game represents a game fetched from the IGDB API
type Game struct {
	ID                    int     `json:"id"`
	Name                  string  `json:"name"`
	Summary               string  `json:"summary"`
	Storyline             string  `json:"storyline"`
	FirstReleaseDate      int64   `json:"first_release_date"`
	AggregatedRating      float64 `json:"aggregated_rating"`
	AggregatedRatingCount int     `json:"aggregated_rating_count"`
	Genres                []int   `json:"genres"`
	Platforms             []int   `json:"platforms"`
	Keywords              []int   `json:"keywords"`
	CoverID               int     `json:"cover"`
	InvolvedCompanies     []int   `json:"involved_companies"`
	ExternalGames         []int   `json:"external_games"`
	Artworks              []int   `json:"artworks"`
	Screenshots           []int   `json:"screenshots"`
	Videos                []int   `json:"videos"`
}

// named represents a generic named entity from IGDB
type named struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// InvolvedCompany represents an involved company entry in IGDB.
type InvolvedCompany struct {
	ID        int  `json:"id"`
	CompanyID int  `json:"company"`
	Publisher bool `json:"publisher"`
	Developer bool `json:"developer"`
}

// cover represents a cover entry in IGDB.
type cover struct {
	ID      int    `json:"id"`
	ImageID string `json:"image_id"`
}

// GameVideo represents a video entry (trailer) in IGDB.
type GameVideo struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	VideoID string `json:"video_id"`
}

// ExternalGame represents an external game entry in IGDB.
type ExternalGame struct {
	ID       int `json:"id"`
	GameID   int `json:"game"`
	Category int `json:"category"`
}