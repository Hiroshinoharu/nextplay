package main

import (
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/maxceban/nextplay/services/gateway/clients"
	middleware "github.com/maxceban/nextplay/services/gateway/middlewares"
	"github.com/maxceban/nextplay/services/gateway/routes"
	"github.com/maxceban/nextplay/services/shared/config"
	"github.com/maxceban/nextplay/services/shared/observability"
)

// main is the entry point for the NextPlay API Gateway service.
//
// It loads configuration from environment variables, sets up the HTTP client timeout,
// registers routes, and starts the server listening on the specified port.
//
// The Gateway service is responsible for routing authenticated requests between the frontend
// and the User, Game, and Recommender services.
//
// The service also exposes a health endpoint for monitoring and debugging purposes.
func main() {
	cfg, err := config.Load(config.Defaults{
		Port:                  "8084",
		FrontendURL:           "http://localhost:5173",
		UserServiceURL:        "http://localhost:8083",
		GameServiceURL:        "http://localhost:8081",
		RecommenderServiceURL: "http://localhost:8082",
	})
	if err != nil {
		log.Fatal("Failed to load config: ", err)
	}

	clients.UserServiceURL = cfg.UserServiceURL
	clients.GameServiceURL = cfg.GameServiceURL
	clients.RecommenderServiceURL = cfg.RecommenderServiceURL

	log.Println("[Gateway] User Service →", clients.UserServiceURL)
	log.Println("[Gateway] Game Service →", clients.GameServiceURL)
	log.Println("[Gateway] Recommender Service →", clients.RecommenderServiceURL)

	upstreamTimeoutSeconds := 20
	if raw := os.Getenv("GATEWAY_UPSTREAM_TIMEOUT_SECONDS"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			upstreamTimeoutSeconds = parsed
		}
	}
	clients.HttpClient.Timeout = time.Duration(upstreamTimeoutSeconds) * time.Second

	app := fiber.New(fiber.Config{
		AppName:      "NextPlay API Gateway",
		ErrorHandler: globalErrorHandler,
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins:     resolveAllowedOrigins(cfg.FrontendURL),
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Content-Type, Authorization, X-CSRF-Token",
		ExposeHeaders:    "X-NextPlay-Auth-Error",
		AllowCredentials: true,
	}))

	app.Use(middleware.SecurityHeaders)
	app.Use(observability.AccessLog("gateway"))
	app.Use(recover.New())

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "gateway": true})
	})

	routes.SetUpRoutes(app)

	log.Println("[Gateway] Listening on port", cfg.Port)
	app.Listen(":" + cfg.Port)
}

func resolveAllowedOrigins(configuredFrontendURL string) string {
	if raw := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS")); raw != "" {
		origins := uniqueOrigins(strings.Split(raw, ",")...)
		if len(origins) > 0 {
			return strings.Join(origins, ",")
		}
	}

	origins := uniqueOrigins(
		configuredFrontendURL,
		"http://localhost:5173",
		"http://127.0.0.1:5173",
		"http://localhost:5174",
		"http://127.0.0.1:5174",
	)
	return strings.Join(origins, ",")
}

func uniqueOrigins(values ...string) []string {
	seen := make(map[string]struct{}, len(values))
	origins := make([]string, 0, len(values))
	for _, value := range values {
		origin := strings.TrimSpace(value)
		if origin == "" {
			continue
		}
		if origin == "*" {
			continue
		}

		if _, ok := seen[origin]; ok {
			continue
		}
		seen[origin] = struct{}{}
		origins = append(origins, origin)
	}
	return origins
}

// ---------------------------
// Helper Functions
// ---------------------------

// Custom global error  handler for clean JSON responses
func globalErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError

	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}

	return c.Status(code).JSON(fiber.Map{
		"error": err.Error(),
	})
}
