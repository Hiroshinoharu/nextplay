package auth

import (
	"errors"
	"unicode"
)

const minPasswordLength = 8

// ValidatePasswordPolicy enforces baseline password complexity for sign-up.
func ValidatePasswordPolicy(password string) error {
	if len(password) < minPasswordLength {
		return errors.New("password must be at least 8 characters and include upper, lower, number, and special character")
	}

	var hasUpper bool
	var hasLower bool
	var hasDigit bool
	var hasSpecial bool

	for _, r := range password {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsDigit(r):
			hasDigit = true
		default:
			hasSpecial = true
		}
	}

	if hasUpper && hasLower && hasDigit && hasSpecial {
		return nil
	}

	return errors.New("password must be at least 8 characters and include upper, lower, number, and special character")
}
