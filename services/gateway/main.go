package main

import (
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/maxceban/nextplay/services/gateway/clients"
	"github.com/maxceban/nextplay/services/gateway/routes"
)

func main() {

	// ---------------------
	// Load Service URLs from Env Vars
	// ---------------------
	clients.UserServiceURL = getEnv("USER_SERVICE_URL", "http://localhost:8083")
	clients.GameServiceURL = getEnv("GAME_SERVICE_URL", "http://localhost:8081")
	clients.RecommenderServiceURL = getEnv("RECOMMENDER_SERVICE_URL", "http://localhost:8082")

	// Print to verify the logs
	log.Println("[Gateway] User Service →", clients.UserServiceURL)
	log.Println("[Gateway] Game Service →", clients.GameServiceURL)
	log.Println("[Gateway] Recommender Service →", clients.RecommenderServiceURL)

	// Global HTTP client timeout for outbound requests
	clients.HttpClient.Timeout = 5 * time.Second

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

	// Logging middleware
	app.Use(logger.New())
	
	// Recovers from panics
	app.Use(recover.New())

	// Health endpoint
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "gateway": true})
	})

	// Register routes
	routes.SetUpRoutes(app)

	// Start server
	port := getEnv("PORT", "8084")
	log.Println("[Gateway] Listening on port", port)
	app.Listen(":" + port)
}

// ---------------------------
// Helper Functions
// ---------------------------

// getEnv returns the environment varaibale or fallback
func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

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
