package models

// Keyword represents a keyword that can be associated with a game.
type Keyword struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}
