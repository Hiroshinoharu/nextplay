package models

// Series represents a series entry linked to games in the catalog.
type Series struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}
