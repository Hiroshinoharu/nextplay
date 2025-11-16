package clients

import "os"

var gameBase = os.Getenv("GAME_SERVICE_URL")

func GameServiceGet(ep string) (map[string]interface{}, error) {
	return doGet(gameBase + ep)
}

func GameServicePost(ep string, body []byte) (map[string]interface{}, error) {
	return doPost(gameBase + ep, body)
}