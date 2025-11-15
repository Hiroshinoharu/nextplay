package clients

import "os"

// Base URL for User Service
var userBase = os.Getenv("USER_SERVICE_URL")

// User Service Client Functions
func UserServiceGet(ep string) (map[string]interface{}, error) {
	return doGet(userBase + ep)
}

// UserServicePost sends a POST request to the User Service
func UserServicePost(ep string, body []byte) (map[string]interface{}, error) {
	return doPost(userBase + ep, body)
}