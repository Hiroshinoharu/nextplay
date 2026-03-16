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

// ChangePassword handles PATCH /api/users/:id/password
func ChangePassword(c *fiber.Ctx) error {
	id := c.Params("id")
	userClient := userClientFromCtx(c)
	resp, err := userClient.ChangePassword(id, c.Body())
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

// GetUserInteractionEvents handles GET /api/users/:id/interactions/events
func GetUserInteractionEvents(c *fiber.Ctx) error {
	id := c.Params("id")
	userClient := userClientFromCtx(c)
	resp, err := userClient.GetUserInteractionEvents(id)
	return sendProxyJSON(c, resp, err)
}

// CreateUserInteractionEvent handles POST /api/users/:id/interactions/events
func CreateUserInteractionEvent(c *fiber.Ctx) error {
	id := c.Params("id")
	userClient := userClientFromCtx(c)
	resp, err := userClient.CreateUserInteractionEvent(id, c.Body())
	return sendProxyJSON(c, resp, err)
}
