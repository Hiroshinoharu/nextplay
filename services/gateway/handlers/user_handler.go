package handlers

import "github.com/gofiber/fiber/v2"

// GetUserByID handles GET /api/users/:id
func GetUserByID(c *fiber.Ctx) error {
	id := c.Params("id")
	userClient := userClientFromCtx(c)
	resp, err := userClient.GetUserByID(id)
	return sendProxyJSON(c, resp, err)
}

// RegisterUser handles POST /api/users/register
func RegisterUser(c *fiber.Ctx) error {
	userClient := userClientFromCtx(c)
	resp, err := userClient.RegisterUser(c.Body())
	return sendProxyJSON(c, resp, err)
}

// LoginUser handles POST /api/users/login
func LoginUser(c *fiber.Ctx) error {
	userClient := userClientFromCtx(c)
	resp, err := userClient.LoginUser(c.Body())
	return sendProxyJSON(c, resp, err)
}

// UpdateUser handles PUT /api/users/:id
func UpdateUser(c *fiber.Ctx) error {
	id := c.Params("id")
	userClient := userClientFromCtx(c)
	resp, err := userClient.UpdateUser(id, c.Body())
	return sendProxyJSON(c, resp, err)
}

// DeleteUser handles DELETE /api/users/:id
func DeleteUser(c *fiber.Ctx) error {
	id := c.Params("id")
	userClient := userClientFromCtx(c)
	resp, err := userClient.DeleteUser(id)
	return sendProxyJSON(c, resp, err)
}

// GetUserInteraction handles GET /api/users/:id/interactions
func GetUserInteraction(c *fiber.Ctx) error {
	id := c.Params("id")
	userClient := userClientFromCtx(c)
	resp, err := userClient.GetUserInteraction(id)
	return sendProxyJSON(c, resp, err)
}

// CreateUserInteraction handles POST /api/users/:id/interactions
func CreateUserInteraction(c *fiber.Ctx) error {
	id := c.Params("id")
	userClient := userClientFromCtx(c)
	resp, err := userClient.CreateUserInteraction(id, c.Body())
	return sendProxyJSON(c, resp, err)
}

// DeleteUserInteraction handles DELETE /api/users/:id/interactions/:gameId
func DeleteUserInteraction(c *fiber.Ctx) error {
	id := c.Params("id")
	gameID := c.Params("gameId")
	userClient := userClientFromCtx(c)
	resp, err := userClient.DeleteUserInteraction(id, gameID)
	return sendProxyJSON(c, resp, err)
}

// GetUserKeywordPreferences handles GET /api/users/:id/keywords
func GetUserKeywordPreferences(c *fiber.Ctx) error {
	id := c.Params("id")
	userClient := userClientFromCtx(c)
	resp, err := userClient.GetUserKeywordPreferences(id)
	return sendProxyJSON(c, resp, err)
}

// CreateUserKeywordPreference handles POST /api/users/:id/keywords
func CreateUserKeywordPreference(c *fiber.Ctx) error {
	id := c.Params("id")
	userClient := userClientFromCtx(c)
	resp, err := userClient.CreateUserKeywordPreference(id, c.Body())
	return sendProxyJSON(c, resp, err)
}

// UpdateUserKeywordPreference handles PUT /api/users/:id/keywords/:keywordId
func UpdateUserKeywordPreference(c *fiber.Ctx) error {
	id := c.Params("id")
	keywordID := c.Params("keywordId")
	userClient := userClientFromCtx(c)
	resp, err := userClient.UpdateUserKeywordPreference(id, keywordID, c.Body())
	return sendProxyJSON(c, resp, err)
}

// DeleteUserKeywordPreference handles DELETE /api/users/:id/keywords/:keywordId
func DeleteUserKeywordPreference(c *fiber.Ctx) error {
	id := c.Params("id")
	keywordID := c.Params("keywordId")
	userClient := userClientFromCtx(c)
	resp, err := userClient.DeleteUserKeywordPreference(id, keywordID)
	return sendProxyJSON(c, resp, err)
}

// GetUserPlatformPreferences handles GET /api/users/:id/platforms
func GetUserPlatformPreferences(c *fiber.Ctx) error {
	id := c.Params("id")
	userClient := userClientFromCtx(c)
	resp, err := userClient.GetUserPlatformPreferences(id)
	return sendProxyJSON(c, resp, err)
}

// CreateUserPlatformPreference handles POST /api/users/:id/platforms
func CreateUserPlatformPreference(c *fiber.Ctx) error {
	id := c.Params("id")
	userClient := userClientFromCtx(c)
	resp, err := userClient.CreateUserPlatformPreference(id, c.Body())
	return sendProxyJSON(c, resp, err)
}

// UpdateUserPlatformPreference handles PUT /api/users/:id/platforms/:platformId
func UpdateUserPlatformPreference(c *fiber.Ctx) error {
	id := c.Params("id")
	platformID := c.Params("platformId")
	userClient := userClientFromCtx(c)
	resp, err := userClient.UpdateUserPlatformPreference(id, platformID, c.Body())
	return sendProxyJSON(c, resp, err)
}

// DeleteUserPlatformPreference handles DELETE /api/users/:id/platforms/:platformId
func DeleteUserPlatformPreference(c *fiber.Ctx) error {
	id := c.Params("id")
	platformID := c.Params("platformId")
	userClient := userClientFromCtx(c)
	resp, err := userClient.DeleteUserPlatformPreference(id, platformID)
	return sendProxyJSON(c, resp, err)
}
