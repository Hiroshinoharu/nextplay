package clients

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

type RecommenderClient struct{
	BaseURL string
}

func NewRecommnederClient() *RecommenderClient{
	baseURL := os.Getenv("RECOMMENDER_SERVICE_URL")
    if baseURL == "" {
        baseURL = "http://recommender:8082"
    }
    return &RecommenderClient{BaseURL: baseURL}
}

func (c *RecommenderClient) RecommendFromFeatures(req interface{}) ([]byte, error){
	url := fmt.Sprintf("%s/recommend", c.BaseURL)

	body, _ := json.Marshal(req)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}

func (c *RecommenderClient) RecommendForUser(userID string) ([]byte, error){
	url := fmt.Sprintf("%s/recommend/user/%s", c.BaseURL, userID)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}