package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/user/handlers"
	"github.com/maxceban/nextplay/services/user/middleware"
)

// SetUpRoutes registers the user service routes and authentication middleware.
func SetUpRoutes(app *fiber.App) {

	// ------------------------
	// USER AUTH + PROFILE
	// ------------------------
	app.Get("/users/availability", handlers.CheckAvailability)
	app.Post("/users/register", handlers.Register)
	app.Post("/users/login", handlers.Login)
	securedUsers := app.Group("/users", middleware.RequireJWT)
	securedUsers.Get("/:id", handlers.GetUserByID)
	securedUsers.Put("/:id", handlers.UpdateUser)
	securedUsers.Patch("/:id/password", handlers.ChangePassword)
	securedUsers.Delete("/:id", handlers.DeleteUser)

	// ------------------------
	// USER INTERACTIONS
	// ------------------------
	securedUsers.Get("/:id/interactions", handlers.GetInteractions)
	securedUsers.Post("/:id/interactions", handlers.AddOrUpdateInteraction)
	securedUsers.Delete("/:id/interactions/:gameId", handlers.DeleteInteraction)
	securedUsers.Get("/:id/interactions/events", handlers.GetInteractionEvents)
	securedUsers.Post("/:id/interactions/events", handlers.AddInteractionEvent)

}
