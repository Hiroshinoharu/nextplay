package clients

import "os"

// Base URL for Recommender Service
var recBase = os.Getenv("RECOMMENDER_SERVICE_URL")

// Recommender Service Client Functions
func RecommenderGet(ep string) (map[string]interface{}, error) {
	return doGet(recBase + ep)
}

// RecommenderPost sends a POST request to the Recommender Service
func RecommenderPost(ep string, payload []byte) (map[string]interface{}, error) {
	return doPost(recBase + ep, payload)
}
