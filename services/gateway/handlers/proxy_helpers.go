package handlers

import (
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	gatewayauth "github.com/maxceban/nextplay/services/gateway/auth"
	"github.com/maxceban/nextplay/services/gateway/clients"
	"github.com/maxceban/nextplay/services/shared/observability"
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
	return clients.NewUserClientWithHeaders(requestAuthorizationHeader(c), requestIDFromCtx(c))
}

func requestIDFromCtx(c *fiber.Ctx) string {
	return observability.RequestID(c)
}

func requestAuthorizationHeader(c *fiber.Ctx) string {
	if authHeader, ok := c.Locals("auth_header").(string); ok && strings.TrimSpace(authHeader) != "" {
		return strings.TrimSpace(authHeader)
	}
	return gatewayauth.AuthorizationHeaderValue(
		c.Get("Authorization"),
		c.Cookies(gatewayauth.SessionCookieName()),
	)
}

func forwardingHeaders(c *fiber.Ctx) map[string]string {
	headers := map[string]string{
		observability.HeaderRequestID: requestIDFromCtx(c),
	}
	if authHeader := requestAuthorizationHeader(c); authHeader != "" {
		headers["Authorization"] = authHeader
	}
	if serviceToken := gatewayServiceToken(); serviceToken != "" {
		headers["X-Service-Token"] = serviceToken
	}
	return headers
}

func gatewayServiceToken() string {
	if token := strings.TrimSpace(os.Getenv("GATEWAY_SERVICE_TOKEN")); token != "" {
		return token
	}
	return strings.TrimSpace(os.Getenv("SERVICE_TOKEN"))
}
