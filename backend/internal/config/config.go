package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL   string
	JWTSecret     string
	Port          string
	FrontendURL   string
	MigrationsDir string
	SeedDemoData  bool
}

func Load() Config {
	_ = godotenv.Load(".env", "backend/.env")

	return Config{
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/creativex_voting?sslmode=disable"),
		JWTSecret:     getEnv("JWT_SECRET", "change-me"),
		Port:          getEnv("PORT", "8080"),
		FrontendURL:   getEnv("FRONTEND_URL", "http://localhost:5173"),
		MigrationsDir: resolveMigrationsDir(),
		SeedDemoData:  getEnvBool("SEED_DEMO_DATA", false),
	}
}

func getEnv(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}

	return parsed
}

func resolveMigrationsDir() string {
	if value := os.Getenv("MIGRATIONS_DIR"); value != "" {
		return value
	}

	candidates := []string{"./migrations", "./backend/migrations"}
	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}

	return "./migrations"
}
