// preferences.go
// Program Description: This program represents my User entity in my DB 
// Date: 15/11/2025

package models

type KeywordPreferences struct {
	UserID int `json:"user_id"`
	KeywordID int `json:"keyword_id"`
	Score int `json:"score"`
}

// PlatformPreferences represents a user's preference for a specific gaming platform, including a score indicating their level of interest or enjoyment with that platform. This struct is used to store and manage user preferences related to gaming platforms in the database.
type PlatformPreferences struct {
	UserID int `json:"user_id"`
	PlatformID int `json:"platform_id"`
	Score int `json:"score"`
}