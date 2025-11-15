// User.go
// Program Description: This program represents my User entity in my DB 
// Date: 15/11/2025

package models

type User struct{
	ID int64 `json:"id"`
	Username string `json:"username"`
	Email string `json:"email"`
	Password string `json:"-"` // Hide in JSON
	SteamLinked bool `json:"steam_linked"`

	// Realations
	Interaction []UserInteraction `json:"interactions"`
	KeywordPrefs []KeywordPreferences `json:"keyword_preferences"`
	PlatformPrefs []PlatformPreferences `json:"platform_preferences"`
}