package models

// Company represents a company associated with games in the catalog.
type Company struct {
	ID               int64  `json:"id"`
	Logo             []byte `json:"company_logo"`
	Description      string `json:"company_description"`
	Country          string `json:"country"`
	DateStarted      string `json:"date_started"`
	GamesContributed string `json:"games_contributed"`
	Website          string `json:"website"`
}
