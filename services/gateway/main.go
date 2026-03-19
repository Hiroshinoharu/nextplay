package main

import (
	"log"
	"os"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/maxceban/nextplay/services/gateway/clients"
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

	// ---------------------
	// Load Service URLs from Env Vars
	// ---------------------
	cfg, err := config.Load(config.Defaults{
		Port:                  "8084",
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

	// Print to verify the logs
	log.Println("[Gateway] User Service →", clients.UserServiceURL)
	log.Println("[Gateway] Game Service →", clients.GameServiceURL)
	log.Println("[Gateway] Recommender Service →", clients.RecommenderServiceURL)

	// Global HTTP client timeout for outbound requests.
	// Some game queries (e.g., random discovery feeds) can exceed 5s on larger datasets.
	upstreamTimeoutSeconds := 20
	if raw := os.Getenv("GATEWAY_UPSTREAM_TIMEOUT_SECONDS"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			upstreamTimeoutSeconds = parsed
		}
	}
	clients.HttpClient.Timeout = time.Duration(upstreamTimeoutSeconds) * time.Second

	// ---------------------------
	// FIBER APP SETUP
	// ---------------------------

	app := fiber.New(fiber.Config{
		AppName:      "NextPlay API Gateway",
		ErrorHandler: globalErrorHandler,
	})

	// Enable CORS (required for frontend communication)
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Content-Type, Authorization",
	}))

	// Access log + request ID middleware
	app.Use(observability.AccessLog("gateway"))

	// Recovers from panics
	app.Use(recover.New())

	// Health endpoint
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "gateway": true})
	})

	// Register routes
	routes.SetUpRoutes(app)

	// Start server
	log.Println("[Gateway] Listening on port", cfg.Port)
	app.Listen(":" + cfg.Port)
}

// ---------------------------
// Helper Functions
// ---------------------------

// Custom global error  handler for clean JSON responses
func globalErrorHandler(c *fiber.Ctx, err error) error {
	// Default 500 statuscode
	code := fiber.StatusInternalServerError

	// Fiber returns *fiber.Error for known HTTP errors
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}

	// Send custom JSON error response
	return c.Status(code).JSON(fiber.Map{
		"error": err.Error(),
	})
}
