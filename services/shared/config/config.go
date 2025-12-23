package config

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Defaults holds default values for config variables.
type Defaults struct {
	Port                  string
	DatabaseURL           string
	FrontendURL           string
	UserServiceURL        string
	GameServiceURL        string
	GatewayServiceURL     string
	RecommenderServiceURL string
}

// Config holds configuration values for the application.
type Config struct {
	Env                   string
	Port                  string
	DatabaseURL           string
	FrontendURL           string
	UserServiceURL        string
	GameServiceURL        string
	GatewayServiceURL     string
	RecommenderServiceURL string
}

// Load loads configuration from environment variables, applying defaults where necessary.
func Load(defaults Defaults) (Config, error) {
	// Load dotenv first so it can define ENV for local dev
	loadDotEnvCandidateFiles()

	fileConfig, err := loadConfigFile()
	if err != nil {
		return Config{}, err
	}

	env := strings.TrimSpace(os.Getenv("ENV"))
	if env == "" {
		env = getConfigValue(fileConfig, "ENV")
		if env == "" {
			env = "development"
		}
	}

	// Optionally load env-specific file after we know ENV
	loadDotEnvForEnv(env)

	// Build final config
	cfg := Config{
		Env:                   env,
		Port:                  getEnvWithConfig("PORT", fileConfig, defaults.Port),
		DatabaseURL:           getEnvWithConfig("DATABASE_URL", fileConfig, defaults.DatabaseURL),
		FrontendURL:           getEnvWithConfig("FRONTEND_URL", fileConfig, defaults.FrontendURL),
		UserServiceURL:        getEnvWithConfig("USER_SERVICE_URL", fileConfig, defaults.UserServiceURL),
		GameServiceURL:        getEnvWithConfig("GAME_SERVICE_URL", fileConfig, defaults.GameServiceURL),
		GatewayServiceURL:     getEnvWithConfig("GATEWAY_SERVICE_URL", fileConfig, defaults.GatewayServiceURL),
		RecommenderServiceURL: getEnvWithConfig("RECOMMENDER_SERVICE_URL", fileConfig, defaults.RecommenderServiceURL),
	}

	// Validate required vars in production
	if env == "production" {
		if strings.TrimSpace(cfg.DatabaseURL) == "" {
			return Config{}, errors.New("DATABASE_URL is required in production")
		}
		if strings.TrimSpace(cfg.Port) == "" {
			return Config{}, errors.New("PORT is required in production")
		}
	}

	return cfg, nil
}

// Loads basic dotenv (optional) using ENV_FILE if provided.
func loadDotEnvCandidateFiles() {
	// If ENV_FILE is set, load that single file
	if path := strings.TrimSpace(os.Getenv("ENV_FILE")); path != "" {
		_ = godotenv.Load(path)
		return
	}

	// Otherwise try default local files
	for _, file := range []string{".env"} {
		if _, err := os.Stat(file); err == nil {
			_ = godotenv.Load(file)
		}
	}
}

// loadDotEnvForEnv loads an env-specific dotenv file if it exists.
func loadDotEnvForEnv(env string) {
	if env == "production" {
		return
	}

	for _, file := range []string{".env." + env} {
		if _, err := os.Stat(file); err == nil {
			_ = godotenv.Load(file)
		}
	}
}

// getEnv retrieves an environment variable or returns a fallback value.
func getEnv(key, fallback string) string {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return fallback
	}
	return val
}

// getEnvWithConfig retrieves an environment variable, then from config file, then fallback.
func getEnvWithConfig(key string, fileConfig map[string]string, fallback string) string {
	val := strings.TrimSpace(os.Getenv(key))
	if val != "" {
		return val
	}
	if val = getConfigValue(fileConfig, key); val != "" {
		return val
	}
	return fallback
}

// loadConfigFile attempts to load a config file and parse it.
func loadConfigFile() (map[string]string, error) {
	if path := strings.TrimSpace(os.Getenv("CONFIG_FILE")); path != "" {
		return readConfigFile(path)
	}

	for _, file := range []string{"config.yaml", "config.yml", "config.json"} {
		if _, err := os.Stat(file); err == nil {
			return readConfigFile(file)
		}
	}

	return nil, nil
}

// readConfigFile reads and parses a config file based on its extension.
func readConfigFile(path string) (map[string]string, error) {
	if _, err := os.Stat(path); err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	switch strings.ToLower(filepath.Ext(path)) {
	case ".json":
		return parseConfigJSON(data)
	case ".yaml", ".yml":
		return parseConfigYAML(data)
	default:
		return nil, fmt.Errorf("unsupported config file extension: %s", filepath.Ext(path))
	}
}

// A simple JSON parser for flat key-value pairs.
func parseConfigJSON(data []byte) (map[string]string, error) {
	var raw map[string]interface{}
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	if err := dec.Decode(&raw); err != nil {
		return nil, err
	}

	out := make(map[string]string, len(raw))
	for key, value := range raw {
		out[normalizeKey(key)] = stringifyConfigValue(value)
	}
	return out, nil
}

// A very simple YAML parser for flat key-value pairs.
func parseConfigYAML(data []byte) (map[string]string, error) {
	out := make(map[string]string)
	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		colon := strings.Index(line, ":")
		if colon == -1 {
			continue
		}
		key := strings.TrimSpace(line[:colon])
		if key == "" {
			continue
		}
		value := strings.TrimSpace(line[colon+1:])
		if idx := strings.Index(value, " #"); idx >= 0 {
			value = strings.TrimSpace(value[:idx])
		}
		if strings.HasPrefix(value, "#") {
			value = ""
		}
		if len(value) >= 2 {
			if (value[0] == '"' && value[len(value)-1] == '"') || (value[0] == '\'' && value[len(value)-1] == '\'') {
				value = value[1 : len(value)-1]
			}
		}
		out[normalizeKey(key)] = value
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// normalizeKey converts a config key to uppercase with underscores.
func normalizeKey(key string) string {
	key = strings.TrimSpace(key)
	if key == "" {
		return ""
	}

	var b strings.Builder
	b.Grow(len(key) + 4)
	prevLower := false
	for _, r := range key {
		switch {
		case r >= 'A' && r <= 'Z':
			if prevLower {
				b.WriteByte('_')
			}
			b.WriteRune(r)
			prevLower = false
		case r >= 'a' && r <= 'z':
			b.WriteRune(r - 32)
			prevLower = true
		case r >= '0' && r <= '9':
			b.WriteRune(r)
			prevLower = false
		default:
			b.WriteByte('_')
			prevLower = false
		}
	}
	return b.String()
}

// stringifyConfigValue converts various types to their string representation.
func stringifyConfigValue(value interface{}) string {
	switch v := value.(type) {
	case string:
		return v
	case json.Number:
		return v.String()
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(v)
	case nil:
		return ""
	default:
		return fmt.Sprint(v)
	}
}

// getConfigValue retrieves a config value from the parsed config file map.
func getConfigValue(fileConfig map[string]string, key string) string {
	if len(fileConfig) == 0 {
		return ""
	}
	if val, ok := fileConfig[normalizeKey(key)]; ok {
		return strings.TrimSpace(val)
	}
	return ""
}
