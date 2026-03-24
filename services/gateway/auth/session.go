package auth

import (
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

const (
	defaultSessionCookieName  = "nextplay_session"
	defaultSessionCookieMaxAgeSecond = 24 * 60 * 60
)

// SessionCookieName returns the configured session cookie name.
func SessionCookieName() string {
	if raw := strings.TrimSpace(os.Getenv("SESSION_COOKIE_NAME")); raw != "" {
		return raw
	}
	return defaultSessionCookieName
}

// ExtractToken returns the bearer token from the Authorization header or session cookie.
func ExtractToken(headerValue string, cookieValue string) string {
	authHeader := strings.TrimSpace(headerValue)
	if len(authHeader) >= 7 && strings.EqualFold(authHeader[:7], "Bearer ") {
		if token := strings.TrimSpace(authHeader[7:]); token != "" {
			return token
		}
	}
	return strings.TrimSpace(cookieValue)
}

// AuthorizationHeaderValue returns a normalized bearer header for upstream forwarding.
func AuthorizationHeaderValue(headerValue string, cookieValue string) string {
	token := ExtractToken(headerValue, cookieValue)
	if token == "" {
		return ""
	}
	return "Bearer " + token
}

// SetSessionCookie writes the gateway session cookie to the response.
func SetSessionCookie(c *fiber.Ctx, token string) {
	trimmedToken := strings.TrimSpace(token)
	if trimmedToken == "" {
		return
	}

	c.Cookie(&fiber.Cookie{
		Name:     SessionCookieName(),
		Value:    trimmedToken,
		Path:     "/",
		HTTPOnly: true,
		Secure:   sessionCookieSecure(),
		SameSite: "Lax",
		MaxAge:   sessionCookieMaxAgeSeconds(),
	})
}

// ClearSessionCookie expires the gateway session cookie.
func ClearSessionCookie(c *fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:     SessionCookieName(),
		Value:    "",
		Path:     "/",
		HTTPOnly: true,
		Secure:   sessionCookieSecure(),
		SameSite: "Lax",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	})
}

func sessionCookieMaxAgeSeconds() int {
	if raw := strings.TrimSpace(os.Getenv("SESSION_COOKIE_MAX_AGE_SECONDS")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			return parsed
		}
	}
	return defaultSessionCookieMaxAgeSecond
}

func sessionCookieSecure() bool {
	if raw := strings.TrimSpace(os.Getenv("SESSION_COOKIE_SECURE")); raw != "" {
		if parsed, err := strconv.ParseBool(raw); err == nil {
			return parsed
		}
	}

	env := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	return env == "production" || env == "staging"
}
