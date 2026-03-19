package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

const (
	defaultCSRFCookieName = "nextplay_csrf"
	defaultCSRFHeaderName = "X-CSRF-Token"
	csrfTokenByteLength   = 32
)

// CSRFCookieName returns the configured CSRF cookie name.
func CSRFCookieName() string {
	if raw := strings.TrimSpace(os.Getenv("CSRF_COOKIE_NAME")); raw != "" {
		return raw
	}
	return defaultCSRFCookieName
}

// CSRFHeaderName returns the configured CSRF request header name.
func CSRFHeaderName() string {
	if raw := strings.TrimSpace(os.Getenv("CSRF_HEADER_NAME")); raw != "" {
		return raw
	}
	return defaultCSRFHeaderName
}

// NewCSRFToken generates a new random CSRF token value.
func NewCSRFToken() (string, error) {
	buffer := make([]byte, csrfTokenByteLength)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

// EnsureCSRFCookie returns the current CSRF cookie or sets a new one when missing.
func EnsureCSRFCookie(c *fiber.Ctx) (string, error) {
	if token := strings.TrimSpace(c.Cookies(CSRFCookieName())); token != "" {
		return token, nil
	}

	token, err := NewCSRFToken()
	if err != nil {
		return "", err
	}

	SetCSRFCookie(c, token)
	return token, nil
}

// SetCSRFCookie writes the CSRF cookie to the response.
func SetCSRFCookie(c *fiber.Ctx, token string) {
	trimmedToken := strings.TrimSpace(token)
	if trimmedToken == "" {
		return
	}

	c.Cookie(&fiber.Cookie{
		Name:     CSRFCookieName(),
		Value:    trimmedToken,
		Path:     "/",
		HTTPOnly: false,
		Secure:   sessionCookieSecure(),
		SameSite: "Strict",
		MaxAge:   sessionCookieMaxAgeSeconds(),
	})
}

// ClearCSRFCookie expires the CSRF cookie.
func ClearCSRFCookie(c *fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:     CSRFCookieName(),
		Value:    "",
		Path:     "/",
		HTTPOnly: false,
		Secure:   sessionCookieSecure(),
		SameSite: "Strict",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	})
}

// ValidateCSRFToken returns true when the CSRF header and cookie tokens match.
func ValidateCSRFToken(cookieToken string, headerToken string) bool {
	trimmedCookieToken := strings.TrimSpace(cookieToken)
	trimmedHeaderToken := strings.TrimSpace(headerToken)
	if trimmedCookieToken == "" || trimmedHeaderToken == "" {
		return false
	}

	return subtle.ConstantTimeCompare(
		[]byte(trimmedCookieToken),
		[]byte(trimmedHeaderToken),
	) == 1
}
