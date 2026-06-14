package services

import (
	"context"
	"errors"

	"creativexvoting/backend/internal/models"
	"creativexvoting/backend/internal/repositories"
	"creativexvoting/backend/internal/utils"

	"github.com/google/uuid"
)

type AuthService struct {
	repo      *repositories.AuthRepository
	jwtSecret string
}

func NewAuthService(repo *repositories.AuthRepository, jwtSecret string) *AuthService {
	return &AuthService{
		repo:      repo,
		jwtSecret: jwtSecret,
	}
}

func (s *AuthService) Login(ctx context.Context, username string, password string) (models.LoginResponse, error) {
	user, err := s.repo.GetUserByUsername(ctx, username)
	if err != nil {
		return models.LoginResponse{}, errors.New("invalid username or password")
	}

	if !user.IsActive {
		return models.LoginResponse{}, errors.New("account is inactive")
	}

	if err = utils.CheckPassword(user.PasswordHash, password); err != nil {
		return models.LoginResponse{}, errors.New("invalid username or password")
	}

	token, err := utils.GenerateToken(s.jwtSecret, user.ID, user.Username, user.DisplayName, user.Role)
	if err != nil {
		return models.LoginResponse{}, err
	}

	user.PasswordHash = ""
	return models.LoginResponse{
		Token: token,
		User:  user,
	}, nil
}

func (s *AuthService) GetCurrentUser(ctx context.Context, token string) (models.User, error) {
	claims, err := utils.ParseToken(s.jwtSecret, token)
	if err != nil {
		return models.User{}, err
	}

	user, err := s.repo.GetUserByID(ctx, claims.UserID)
	if err != nil {
		return models.User{}, err
	}
	if !user.IsActive {
		return models.User{}, errors.New("account is inactive")
	}

	user.PasswordHash = ""
	return user, nil
}

func (s *AuthService) CreateOrUpdateAdmin(ctx context.Context, username string, password string, displayName string) error {
	passwordHash, err := utils.HashPassword(password)
	if err != nil {
		return err
	}

	return s.repo.UpsertAdmin(ctx, models.User{
		ID:           uuid.NewString(),
		Username:     username,
		DisplayName:  displayName,
		PasswordHash: passwordHash,
		Role:         models.RoleAdmin,
		IsActive:     true,
	})
}
