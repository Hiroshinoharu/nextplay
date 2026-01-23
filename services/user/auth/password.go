package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"strings"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/bcrypt"
)

// Argon2id parameters for password hashing 
const (
	argonTime    = 1 // Number of iterations
	argonMemory  = 64 * 1024 // 64 MB
	argonThreads = 4 // Number of parallelism threads
	argonKeyLen  = 32 // Length of the generated key
	saltLen      = 16 // Length of the random salt
)

// HashPassword hashes the given password using Argon2id algorithm
func HashPassword(password string) (string, error) {
	// Append pepper if set
	pepper := strings.TrimSpace(os.Getenv("PASSWORD_PEPPER"))
	
	// Append pepper if set
	pw := password
	if pepper != "" {
		pw = pw + pepper
	}

	// Generate a random salt
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	// Hash the password with Argon2id
	hash := argon2.IDKey([]byte(pw), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	
	// Encode the parameters, salt, and hash into a single string
	return fmt.Sprintf(
		"$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
		argonMemory,
		argonTime,
		argonThreads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(hash),
	), nil
}

// VerifyPassword checks if the provided password matches the stored hash
func VerifyPassword(password, stored string) (bool, bool, error) {
	// Determine the hashing algorithm used based on the prefix
	switch {
	case strings.HasPrefix(stored, "$argon2id$"):
		ok, err := verifyArgon2(password, stored)
		return ok, false, err
	case strings.HasPrefix(stored, "$2a$") || strings.HasPrefix(stored, "$2b$") || strings.HasPrefix(stored, "$2y$"):
		ok, err := verifyBcrypt(password, stored)
		return ok, ok, err
	default:
		return false, false, errors.New("unknown password hash format")
	}
}

// verifyBcrypt checks a bcrypt hashed password
func verifyBcrypt(password, stored string) (bool, error) {
	// Append pepper if set
	pepper := strings.TrimSpace(os.Getenv("PASSWORD_PEPPER"))
	pw := password
	if pepper != "" {
		pw = pw + pepper
	}

	if err := bcrypt.CompareHashAndPassword([]byte(stored), []byte(pw)); err != nil {
		if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// verifyArgon2 checks an Argon2id hashed password
func verifyArgon2(password, stored string) (bool, error) {
	pepper := strings.TrimSpace(os.Getenv("PASSWORD_PEPPER"))
	
	// Append pepper if set
	pw := password
	if pepper != "" {
		pw = pw + pepper
	}
	
	// Split the stored hash into its components
	parts := strings.Split(stored, "$")
	if len(parts) != 6 {
		return false, errors.New("invalid argon2 hash")
	}

	// Parse parameters
	var mem uint32
	var time uint32
	var threads uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &mem, &time, &threads); err != nil {
		return false, errors.New("invalid argon2 params")
	}

	// Decode salt
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, errors.New("invalid argon2 salt")
	}

	// Decode hash
	hash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, errors.New("invalid argon2 hash")
	}

	// Compute the hash with the same parameters and compare 
	calculated := argon2.IDKey([]byte(pw), salt, time, mem, threads, uint32(len(hash)))
	if subtle.ConstantTimeCompare(hash, calculated) != 1 {
		return false, nil
	}
	return true, nil
}

