package config

import (
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL            string
	JWTSecret              string
	Port                   string
	FrontendURL            string
	AllowedFrontendOrigins []string
	MigrationsDir          string
	SeedDemoData           bool
	UploadsDir             string
}

func Load() Config {
	_ = godotenv.Load(".env", "backend/.env")

	frontendURL := getEnv("FRONTEND_URL", "http://localhost:5173")

	return Config{
		DatabaseURL:            getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/creativex_voting?sslmode=disable"),
		JWTSecret:              getEnv("JWT_SECRET", "change-me"),
		Port:                   getEnv("PORT", "8080"),
		FrontendURL:            frontendURL,
		AllowedFrontendOrigins: expandFrontendOrigins(frontendURL),
		MigrationsDir:          resolveMigrationsDir(),
		SeedDemoData:           getEnvBool("SEED_DEMO_DATA", false),
		UploadsDir:             getEnv("UPLOADS_DIR", "/app/uploads"),
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

func expandFrontendOrigins(frontendURL string) []string {
	origins := []string{}
	seen := map[string]struct{}{}

	addOrigin := func(origin string) {
		if origin == "" {
			return
		}
		if _, exists := seen[origin]; exists {
			return
		}
		seen[origin] = struct{}{}
		origins = append(origins, origin)
	}

	for _, rawOrigin := range strings.Split(frontendURL, ",") {
		origin := strings.TrimSpace(rawOrigin)
		if origin == "" {
			continue
		}

		addOrigin(origin)

		parsed, err := url.Parse(origin)
		if err != nil {
			continue
		}

		switch parsed.Hostname() {
		case "localhost":
			parsed.Host = strings.Replace(parsed.Host, "localhost", "127.0.0.1", 1)
			addOrigin(parsed.String())
		case "127.0.0.1":
			parsed.Host = strings.Replace(parsed.Host, "127.0.0.1", "localhost", 1)
			addOrigin(parsed.String())
		}
	}

	return origins
}
