package repositories

import (
	"context"

	"creativexvoting/backend/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type AuthRepository struct {
	pool *pgxpool.Pool
}

func NewAuthRepository(pool *pgxpool.Pool) *AuthRepository {
	return &AuthRepository{pool: pool}
}

func (r *AuthRepository) GetUserByUsername(ctx context.Context, username string) (models.User, error) {
	return scanUser(r.pool.QueryRow(ctx, `
		SELECT id, username, display_name, password_hash, role, is_active, created_at, updated_at
		FROM users
		WHERE username = $1
	`, username))
}

func (r *AuthRepository) GetUserByID(ctx context.Context, id string) (models.User, error) {
	return scanUser(r.pool.QueryRow(ctx, `
		SELECT id, username, display_name, password_hash, role, is_active, created_at, updated_at
		FROM users
		WHERE id = $1
	`, id))
}

func (r *AuthRepository) UpsertAdmin(ctx context.Context, user models.User) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO users (id, username, password_hash, display_name, role, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
		ON CONFLICT (username) DO UPDATE
		SET password_hash = EXCLUDED.password_hash,
			display_name = EXCLUDED.display_name,
			role = EXCLUDED.role,
			is_active = TRUE,
			updated_at = NOW()
	`, user.ID, user.Username, user.PasswordHash, user.DisplayName, user.Role)
	return err
}
