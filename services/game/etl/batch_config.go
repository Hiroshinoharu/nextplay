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

func loadETLBatchConfig() etlBatchConfig {
	return etlBatchConfig{
		NamedRows: positiveEnvInt("ETL_DB_NAMED_BATCH_SIZE", 2000),
		Games:     positiveEnvInt("ETL_DB_GAME_BATCH_SIZE", 500),
		Joins:     positiveEnvInt("ETL_DB_JOIN_BATCH_SIZE", 5000),
		Companies: positiveEnvInt("ETL_DB_COMPANY_BATCH_SIZE", 5000),
		Media:     positiveEnvInt("ETL_DB_MEDIA_BATCH_SIZE", 2000),
	}
}

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
