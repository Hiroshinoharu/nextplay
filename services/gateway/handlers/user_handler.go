package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	gatewayauth "github.com/maxceban/nextplay/services/gateway/auth"
)

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
	return sendAuthProxyJSON(c, resp, err)
}

// CheckUserAvailability handles GET /api/users/availability
func CheckUserAvailability(c *fiber.Ctx) error {
	userClient := userClientFromCtx(c)
	query := strings.TrimSpace(c.Context().QueryArgs().String())
	if query != "" {
		query = "?" + query
	}
	resp, err := userClient.CheckAvailability(query)
	return sendProxyJSON(c, resp, err)
}

// LoginUser handles POST /api/users/login
func LoginUser(c *fiber.Ctx) error {
	userClient := userClientFromCtx(c)
	resp, err := userClient.LoginUser(c.Body())
	return sendAuthProxyJSON(c, resp, err)
}

// GetCSRFToken handles GET /api/users/csrf.
func GetCSRFToken(c *fiber.Ctx) error {
	token, err := gatewayauth.EnsureCSRFCookie(c)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to generate csrf token"})
	}
	return c.JSON(fiber.Map{"csrf_token": token})
}

// LogoutUser handles POST /api/users/logout
func LogoutUser(c *fiber.Ctx) error {
	gatewayauth.ClearCSRFCookie(c)
	gatewayauth.ClearSessionCookie(c)
	return c.SendStatus(fiber.StatusNoContent)
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

// sendAuthProxyJSON sends a JSON response with the payload, sets the session cookie
// to the extracted token and sets a new CSRF token. If the payload is missing a token,
// or if there is an error generating the CSRF token, it returns an error response.
// The response will be a JSON object with a single key "error" and a value describing
// the error.
func sendAuthProxyJSON(c *fiber.Ctx, payload interface{}, err error) error {
	if err != nil {
		return writeProxyError(c, err)
	}

	token := extractAuthToken(payload)
	if token == "" {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "upstream auth response missing token"})
	}

	gatewayauth.SetSessionCookie(c, token)
	csrfToken, csrfErr := gatewayauth.NewCSRFToken()
	if csrfErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to generate csrf token"})
	}
	gatewayauth.SetCSRFCookie(c, csrfToken)
	return c.JSON(stripAuthToken(payload))
}

// extractAuthToken extracts a token from the payload if it exists.
// It supports payloads of type map[string]interface{} and fiber.Map.
// If the payload is of any other type, it returns an empty string.
func extractAuthToken(payload interface{}) string {
	switch data := payload.(type) {
	case map[string]interface{}:
		return extractAuthTokenFromMap(data)
	case fiber.Map:
		return extractAuthTokenFromMap(map[string]interface{}(data))
	default:
		return ""
	}
}

// extractAuthTokenFromMap extracts a token from the given map if it exists.
// It searches for the keys "token", "access_token", and "jwt" and returns the first non-empty token it finds.
// If no token is found, it returns an empty string.
func extractAuthTokenFromMap(data map[string]interface{}) string {
	for _, key := range []string{"token", "access_token", "jwt"} {
		if value, ok := data[key].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}


// stripAuthToken removes any authentication tokens from the given payload.
// It supports payloads of type map[string]interface{} and fiber.Map.
// If the payload is of any other type, it returns the original payload.
// The function iterates over the payload and removes any keys that match the
// following values (case insensitive): "token", "access_token", "jwt".
// The resulting payload is returned as an interface{} and can be safely cast
// back to the original type.
func stripAuthToken(payload interface{}) interface{} {
	switch data := payload.(type) {
	case map[string]interface{}:
		sanitized := make(map[string]interface{}, len(data))
		for key, value := range data {
			if isAuthTokenKey(key) {
				continue
			}
			sanitized[key] = value
		}
		return sanitized
	case fiber.Map:
		sanitized := fiber.Map{}
		for key, value := range data {
			if isAuthTokenKey(key) {
				continue
			}
			sanitized[key] = value
		}
		return sanitized
	default:
		return payload
	}
}

// isAuthTokenKey returns true if the given key is one of the following (case insensitive):
// "token", "access_token", "jwt". It returns false otherwise.
func isAuthTokenKey(key string) bool {
	switch strings.ToLower(strings.TrimSpace(key)) {
	case "token", "access_token", "jwt":
		return true
	default:
		return false
	}
}
