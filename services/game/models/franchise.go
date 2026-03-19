package models

// Franchise represents a franchise entry linked to games in the catalog.
type Franchise struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}
