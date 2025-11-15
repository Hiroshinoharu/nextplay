// preferences.go
// Program Description: This program represents my User entity in my DB 
// Date: 15/11/2025

package models

type KeywordPreferences struct {
	UserID int `json:"user_id"`
	KeywordID int `json:"keyword_id"`
	Score int `json:"score"`
}

type PlatformPreferences struct {
	UserID int `json:"user_id"`
	PlatformID int `json:"platform_id"`
	Score int `json:"score"`
}