package services

import (
	"context"
	"errors"

	"creativexvoting/backend/internal/models"
	"creativexvoting/backend/internal/repositories"
	"creativexvoting/backend/internal/utils"
)

type AdminService struct {
	repo         *repositories.AdminRepository
	imageService *ImageService
}

func NewAdminService(repo *repositories.AdminRepository, imageService *ImageService) *AdminService {
	return &AdminService{repo: repo, imageService: imageService}
}

func (s *AdminService) Dashboard(ctx context.Context) (models.DashboardStats, error) {
	return s.repo.GetDashboardStats(ctx)
}

func (s *AdminService) ListAwardGroups(ctx context.Context) ([]models.AwardGroup, error) {
	return s.repo.ListAwardGroups(ctx)
}

func (s *AdminService) ListCategories(ctx context.Context) ([]models.Category, error) {
	return s.repo.ListCategories(ctx)
}

func (s *AdminService) CreateCategory(ctx context.Context, payload models.CategoryPayload) (models.Category, error) {
	if payload.Name == "" {
		return models.Category{}, errors.New("category name is required")
	}
	return s.repo.CreateCategory(ctx, payload)
}

func (s *AdminService) UpdateCategory(ctx context.Context, id string, payload models.CategoryPayload) (models.Category, error) {
	if payload.Name == "" {
		return models.Category{}, errors.New("category name is required")
	}
	return s.repo.UpdateCategory(ctx, id, payload)
}

func (s *AdminService) DeleteCategory(ctx context.Context, id string) error {
	return s.repo.SoftDeleteCategory(ctx, id)
}

func (s *AdminService) ListProjects(ctx context.Context, categoryID string, search string) ([]models.Project, error) {
	return s.repo.ListProjects(ctx, categoryID, search)
}

func (s *AdminService) CreateProject(ctx context.Context, payload models.ProjectPayload) (models.Project, error) {
	if payload.Title == "" || payload.CategoryID == "" {
		return models.Project{}, errors.New("project title and category are required")
	}
	return s.repo.CreateProject(ctx, payload)
}

func (s *AdminService) UpdateProject(ctx context.Context, id string, payload models.ProjectPayload) (models.Project, error) {
	if payload.Title == "" || payload.CategoryID == "" {
		return models.Project{}, errors.New("project title and category are required")
	}
	project, previousImageURL, err := s.repo.UpdateProject(ctx, id, payload)
	if err != nil {
		return models.Project{}, err
	}
	if previousImageURL != "" && previousImageURL != project.ImageURL {
		s.imageService.Delete(previousImageURL)
	}
	return project, nil
}

func (s *AdminService) DeleteProject(ctx context.Context, id string) error {
	return s.repo.SoftDeleteProject(ctx, id)
}

func (s *AdminService) ListCriteria(ctx context.Context, categoryID string) ([]models.ScoringCriterion, error) {
	return s.repo.ListCriteria(ctx, categoryID)
}

func (s *AdminService) CreateCriterion(ctx context.Context, payload models.CriterionPayload) (models.ScoringCriterion, error) {
	if payload.Name == "" || payload.CategoryID == "" {
		return models.ScoringCriterion{}, errors.New("criterion name and category are required")
	}
	return s.repo.CreateCriterion(ctx, payload)
}

func (s *AdminService) UpdateCriterion(ctx context.Context, id string, payload models.CriterionPayload) (models.ScoringCriterion, error) {
	if payload.Name == "" || payload.CategoryID == "" {
		return models.ScoringCriterion{}, errors.New("criterion name and category are required")
	}
	return s.repo.UpdateCriterion(ctx, id, payload)
}

func (s *AdminService) DeleteCriterion(ctx context.Context, id string) error {
	return s.repo.SoftDeleteCriterion(ctx, id)
}

func (s *AdminService) ListJudges(ctx context.Context) ([]models.User, error) {
	return s.repo.ListJudges(ctx)
}

func (s *AdminService) CreateJudge(ctx context.Context, payload models.JudgePayload) (models.User, error) {
	if payload.Username == "" || payload.DisplayName == "" || payload.Password == "" {
		return models.User{}, errors.New("username, display name, and password are required")
	}

	if payload.Role == "" {
		payload.Role = models.RoleJudge
	}

	passwordHash, err := utils.HashPassword(payload.Password)
	if err != nil {
		return models.User{}, err
	}

	return s.repo.CreateJudge(ctx, payload, passwordHash)
}

func (s *AdminService) UpdateJudge(ctx context.Context, id string, payload models.JudgePayload) (models.User, error) {
	if payload.Username == "" || payload.DisplayName == "" {
		return models.User{}, errors.New("username and display name are required")
	}
	if payload.Role == "" {
		payload.Role = models.RoleJudge
	}
	return s.repo.UpdateJudge(ctx, id, payload)
}

func (s *AdminService) DeleteJudge(ctx context.Context, id string) error {
	return s.repo.SoftDeleteJudge(ctx, id)
}

func (s *AdminService) ResetPassword(ctx context.Context, id string, password string) error {
	if password == "" {
		return errors.New("password is required")
	}
	passwordHash, err := utils.HashPassword(password)
	if err != nil {
		return err
	}
	return s.repo.ResetPassword(ctx, id, passwordHash)
}

func (s *AdminService) GetJudgeAssignments(ctx context.Context, judgeID string) ([]string, error) {
	return s.repo.GetJudgeGroupIDs(ctx, judgeID)
}

func (s *AdminService) ReplaceJudgeAssignments(ctx context.Context, judgeID string, groupIDs []string) error {
	return s.repo.ReplaceJudgeAssignments(ctx, judgeID, groupIDs)
}

func (s *AdminService) DeleteJudgeAssignment(ctx context.Context, judgeID string, groupID string) error {
	return s.repo.DeleteJudgeAssignment(ctx, judgeID, groupID)
}

func (s *AdminService) Results(ctx context.Context, categoryID string, judgeID string) (models.ResultsResponse, error) {
	return s.repo.GetResults(ctx, categoryID, judgeID)
}

func (s *AdminService) ExportResults(ctx context.Context, categoryID string, judgeID string) ([]models.CSVExportRow, error) {
	return s.repo.ExportResults(ctx, categoryID, judgeID)
}

func (s *AdminService) ProjectVoteDetail(ctx context.Context, projectID string) (models.ProjectVoteDetail, error) {
	return s.repo.GetProjectVoteDetail(ctx, projectID)
}
