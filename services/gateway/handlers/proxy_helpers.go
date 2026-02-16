package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/maxceban/nextplay/services/gateway/clients"
)

// Helper to write error response for proxy handlers
func writeProxyError(c *fiber.Ctx, err error) error {
	if httpErr, ok := err.(*clients.HTTPError); ok {
		if len(httpErr.Body) == 0 {
			return c.Status(httpErr.Status).JSON(fiber.Map{"error": "upstream error"})
		}
		return c.Status(httpErr.Status).Send(httpErr.Body)
	}
	return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
}

// Helper to send byte response for proxy handlers
func sendProxyBytes(c *fiber.Ctx, status int, data []byte, err error) error {
	if err != nil {
		return writeProxyError(c, err)
	}
	return c.Status(status).Send(data)
}

// Helper to send JSON response for proxy handlers
func sendProxyJSON(c *fiber.Ctx, payload interface{}, err error) error {
	if err != nil {
		return writeProxyError(c, err)
	}
	return c.JSON(payload)
}

// Helper to create UserClient with Authorization header from request context
func userClientFromCtx(c *fiber.Ctx) *clients.UserClient {
	return clients.NewUserClientWithAuth(c.Get("Authorization"))
}
