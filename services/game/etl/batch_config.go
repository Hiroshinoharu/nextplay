package main

import (
	"log"
	"os"
	"strconv"
	"strings"
)

type etlBatchConfig struct {
	NamedRows int
	Games     int
	Joins     int
	Companies int
	Media     int
}

// loadETLBatchConfig loads the batch configuration for the ETL pipeline from environment variables.
//
// The following environment variables are used with the given default values:
// - ETL_DB_NAMED_BATCH_SIZE: int, default 2000
// - ETL_DB_GAME_BATCH_SIZE: int, default 500
// - ETL_DB_JOIN_BATCH_SIZE: int, default 5000
// - ETL_DB_COMPANY_BATCH_SIZE: int, default 5000
// - ETL_DB_MEDIA_BATCH_SIZE: int, default 2000
//
// If an environment variable is empty or invalid, the default value is used instead.
// The returned etlBatchConfig contains the parsed values for the corresponding batch sizes.
func loadETLBatchConfig() etlBatchConfig {
	return etlBatchConfig{
		NamedRows: positiveEnvInt("ETL_DB_NAMED_BATCH_SIZE", 2000),
		Games:     positiveEnvInt("ETL_DB_GAME_BATCH_SIZE", 500),
		Joins:     positiveEnvInt("ETL_DB_JOIN_BATCH_SIZE", 5000),
		Companies: positiveEnvInt("ETL_DB_COMPANY_BATCH_SIZE", 5000),
		Media:     positiveEnvInt("ETL_DB_MEDIA_BATCH_SIZE", 2000),
	}
}

// positiveEnvInt retrieves an environment variable as a positive integer, falling back to the given default value if the variable is empty or invalid.
//
// If the environment variable is empty, the function returns the default value.
// If the environment variable is not empty but cannot be parsed into a positive integer, the function logs an error message with the key, raw value, and default value, and returns the default value.
// If the environment variable is not empty and can be parsed into a positive integer, the function returns the parsed value.
func positiveEnvInt(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}

	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		log.Printf("Invalid %s=%q, using default %d", key, raw, fallback)
		return fallback
	}

	return value
}
