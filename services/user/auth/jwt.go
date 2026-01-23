// services/user/auth/jwt.go
// Package auth provides JWT authentication functionalities JWT is used for user authentication and session management.

package auth

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Token time-to-live duration for issued tokens
const tokenTTL = 24 * time.Hour

// secret retrieves the JWT secret from environment variables
func secret() ([]byte, error) {
	val := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if val == "" {
		return nil, errors.New("JWT_SECRET not set")
	}
	return []byte(val), nil
}

// CreateToken generates a JWT token for the given user ID
func CreateToken(userID int64) (string, error) {
	key, err := secret()
	if err != nil {
		return "", err
	}

	now := time.Now()
	claims := jwt.RegisteredClaims{
		Subject:   strconv.FormatInt(userID, 10),
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(tokenTTL)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(key)
}

// ParseToken validates the JWT token and returns the claims
func ParseToken(tokenStr string) (*jwt.RegisteredClaims, error) {
	// Retrieve the secret key
	key, err := secret()
	if err != nil {
		return nil, err
	}

	// Parse the token with the claims
	parsed, err := jwt.ParseWithClaims(
		tokenStr,
		&jwt.RegisteredClaims{},
		func(t *jwt.Token) (interface{}, error) {
			return key, nil
		},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
	)
	if err != nil || !parsed.Valid {
		return nil, errors.New("invalid token")
	}

	claims, ok := parsed.Claims.(*jwt.RegisteredClaims)
	if !ok {
		return nil, errors.New("invalid claims")
	}
	return claims, nil
}
