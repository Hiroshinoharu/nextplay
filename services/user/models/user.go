// User.go
// Program Description: This program represents my User entity in my DB 
// Date: 15/11/2025

package models

type User struct{
	ID int `json:"id"`
	Username string `json:"username"`
	Email string `json:"email"`
	Password string `json:"password"`
}