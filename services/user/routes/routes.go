package routes

import (
    "github.com/gofiber/fiber/v2"
    "github.com/maxceban/nextplay/services/user/handlers"
    "github.com/maxceban/nextplay/services/user/middleware"
)

func SetUpRoutes(app *fiber.App) {

    // ------------------------
    // USER AUTH + PROFILE
    // ------------------------
    app.Post("/users/register", handlers.Register)
    app.Post("/users/login", handlers.Login)
    securedUsers := app.Group("/users", middleware.RequireJWT)
    securedUsers.Get("/:id", handlers.GetUserByID)
    securedUsers.Put("/:id", handlers.UpdateUser)
    securedUsers.Delete("/:id", handlers.DeleteUser)

    // ------------------------
    // USER INTERACTIONS
    // ------------------------
    securedUsers.Get("/:id/interactions", handlers.GetInteractions)
    securedUsers.Post("/:id/interactions", handlers.AddOrUpdateInteraction)
    securedUsers.Delete("/:id/interactions/:gameId", handlers.DeleteInteraction)

    // ------------------------
    // USER KEYWORD PREFS
    // ------------------------
    securedUsers.Get("/:id/keywords", handlers.GetKeywordPreferences)
    securedUsers.Post("/:id/keywords", handlers.AddKeywordPreference)
    securedUsers.Put("/:id/keywords/:keywordId", handlers.UpdateKeywordPreference)
    securedUsers.Delete("/:id/keywords/:keywordId", handlers.DeleteKeywordPreference)

    // ------------------------
    // USER PLATFORM PREFS
    // ------------------------
    securedUsers.Get("/:id/platforms", handlers.GetPlatformPreferences)
    securedUsers.Post("/:id/platforms", handlers.AddPlatformPreference)
    securedUsers.Put("/:id/platforms/:platformId", handlers.UpdatePlatformPreference)
    securedUsers.Delete("/:id/platforms/:platformId", handlers.DeletePlatformPreference)
}
