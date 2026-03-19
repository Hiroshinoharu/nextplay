// interactioons.go
// Program Description: This program represents my User entity in my DB
// Date: 15/11/2025

package models

// UserInteraction captures a user's rating, review, and preference for a game.
type UserInteraction struct {
	UserID int     `json:"user_id"`
	GameID int     `json:"game_id"`
	Rating float64 `json:"rating"`
	Review string  `json:"review"`
	Liked  bool    `json:"liked"`
}
