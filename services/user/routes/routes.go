package routes

import (
    "github.com/gofiber/fiber/v2"
    "github.com/maxceban/nextplay/services/user/handlers"
)

func SetUpRoutes(app *fiber.App) {

    // ------------------------
    // USER AUTH + PROFILE
    // ------------------------
    app.Post("/users/register", handlers.Register)
    app.Post("/users/login", handlers.Login)
    app.Get("/users/:id", handlers.GetUserByID)
    app.Put("/users/:id", handlers.UpdateUser)
    app.Delete("/users/:id", handlers.DeleteUser)

    // ------------------------
    // USER INTERACTIONS
    // ------------------------
    app.Get("/users/:id/interactions", handlers.GetInteractions)
    app.Post("/users/:id/interactions", handlers.AddOrUpdateInteraction)
    app.Delete("/users/:id/interactions/:gameId", handlers.DeleteInteraction)

    // ------------------------
    // USER KEYWORD PREFS
    // ------------------------
    app.Get("/users/:id/keywords", handlers.GetKeywordPreferences)
    app.Post("/users/:id/keywords", handlers.AddKeywordPreference)
    app.Put("/users/:id/keywords/:keywordId", handlers.UpdateKeywordPreference)
    app.Delete("/users/:id/keywords/:keywordId", handlers.DeleteKeywordPreference)

    // ------------------------
    // USER PLATFORM PREFS
    // ------------------------
    app.Get("/users/:id/platforms", handlers.GetPlatformPreferences)
    app.Post("/users/:id/platforms", handlers.AddPlatformPreference)
    app.Put("/users/:id/platforms/:platformId", handlers.UpdatePlatformPreference)
    app.Delete("/users/:id/platforms/:platformId", handlers.DeletePlatformPreference)
}
