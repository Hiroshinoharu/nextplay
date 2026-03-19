package models

// Platform represents a platform on which a game can be released.
type Platform struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	Manufacturer string `json:"manufacturer"`
	IconURL      []byte `json:"icon_url"`
	Description  string `json:"description"`
	ProductURL   string `json:"product_url"`
}
