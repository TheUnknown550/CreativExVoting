package middleware

import (
	"context"
	"net/http"
	"strings"

	"creativexvoting/backend/internal/models"
	"creativexvoting/backend/internal/services"
	"creativexvoting/backend/internal/utils"
)

type contextKey string

const userContextKey contextKey = "user"

func RequireAuth(authService *services.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if header == "" {
				utils.Error(w, http.StatusUnauthorized, "missing authorization header")
				return
			}

			token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer"))
			if token == "" {
				utils.Error(w, http.StatusUnauthorized, "invalid authorization header")
				return
			}

			user, err := authService.GetCurrentUser(r.Context(), token)
			if err != nil {
				utils.Error(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}

			ctx := context.WithValue(r.Context(), userContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireRole(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := CurrentUser(r.Context())
			if user.ID == "" {
				utils.Error(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			if user.Role != role {
				utils.Error(w, http.StatusForbidden, "forbidden")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func CurrentUser(ctx context.Context) models.User {
	user, _ := ctx.Value(userContextKey).(models.User)
	return user
}
