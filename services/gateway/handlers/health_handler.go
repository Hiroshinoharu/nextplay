package handlers

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/gateway/clients"
)

func GetGatewayHealth(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"status": "ok", "gateway": true})
}

func GetAllHealth(c *fiber.Ctx) error {
	results := fiber.Map{}
	ok := true
	checkedAt := time.Now().Format(time.RFC3339)

	results["gateway"] = fiber.Map{
		"status":      "ok",
		"http_status": fiber.StatusOK,
		"detail":      fiber.Map{"status": "ok", "gateway": true},
	}

	serviceURLs := map[string]string{
		"user":        clients.UserServiceURL,
		"game":        clients.GameServiceURL,
		"recommender": clients.RecommenderServiceURL,
	}

	for name, baseURL := range serviceURLs {
		if baseURL == "" {
			ok = false
			results[name] = fiber.Map{
				"status": "error",
				"error":  fmt.Sprintf("%s service URL not configured", name),
			}
			continue
		}

		url := fmt.Sprintf("%s/health", strings.TrimRight(baseURL, "/"))
		status, data, err := clients.GetRaw(url)
		if err != nil {
			ok = false
			results[name] = fiber.Map{
				"status": "error",
				"error":  err.Error(),
			}
			continue
		}

		var detail interface{}
		if err := json.Unmarshal(data, &detail); err != nil {
			detail = string(data)
		}

		if status < 200 || status >= 300 {
			ok = false
		}

		results[name] = fiber.Map{
			"status":      map[bool]string{true: "ok", false: "error"}[status >= 200 && status < 300],
			"http_status": status,
			"detail":      detail,
		}
	}

	httpStatus := fiber.StatusOK
	if !ok {
		httpStatus = fiber.StatusServiceUnavailable
	}

	return c.Status(httpStatus).JSON(fiber.Map{
		"ok":         ok,
		"checked_at": checkedAt,
		"services":   results,
	})
}

func GetUserHealth(c *fiber.Ctx) error {
	return forwardHealth(c, clients.UserServiceURL, "user")
}

func GetGameHealth(c *fiber.Ctx) error {
	return forwardHealth(c, clients.GameServiceURL, "game")
}

func GetRecommenderHealth(c *fiber.Ctx) error {
	return forwardHealth(c, clients.RecommenderServiceURL, "recommender")
}

// forwardHealth forwards the health check request to the specified service.
func forwardHealth(c *fiber.Ctx, baseURL, name string) error {
	// Check if baseURL is configured
	if baseURL == "" {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": fmt.Sprintf("%s service URL not configured", name)})
	}

	url := fmt.Sprintf("%s/health", strings.TrimRight(baseURL, "/"))
	status, data, err := clients.GetRaw(url)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(status).Send(data)
}
