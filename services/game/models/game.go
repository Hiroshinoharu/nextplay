package models

type Game struct {
    ID 			int64   `json:"id"`
    Name        string  `json:"name"`
    Description string  `json:"description"`
    ReleaseDate string  `json:"release_date"`
    Genre       string  `json:"genre"`
    Publishers  string  `json:"publishers"`
    CoverImage  []byte  `json:"cover_image"`
    Story       string  `json:"story"`

    // Relationship lists (IDs only)
	Platforms  []int64 `json:"platforms"`
	Keywords   []int64 `json:"keywords"`
	Franchises []int64 `json:"franchises"`
	Companies  []int64 `json:"companies"`
	Series     []int64 `json:"series"`
}