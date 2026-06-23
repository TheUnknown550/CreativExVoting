package services

import (
	"context"
	"errors"

	"creativexvoting/backend/internal/models"
	"creativexvoting/backend/internal/repositories"
)

type JudgeService struct {
	repo *repositories.JudgeRepository
}

func NewJudgeService(repo *repositories.JudgeRepository) *JudgeService {
	return &JudgeService{repo: repo}
}

func (s *JudgeService) Groups(ctx context.Context, judgeID string) ([]models.JudgeAwardGroup, error) {
	return s.repo.ListGroups(ctx, judgeID)
}

func (s *JudgeService) Categories(ctx context.Context, judgeID string, groupID string) ([]models.Category, error) {
	return s.repo.ListAssignedCategories(ctx, judgeID, groupID)
}

func (s *JudgeService) Projects(ctx context.Context, judgeID string, categoryID string) ([]models.JudgeProjectCard, error) {
	return s.repo.ListProjects(ctx, judgeID, categoryID)
}

func (s *JudgeService) ProjectDetail(ctx context.Context, judgeID string, projectID string) (models.JudgeProjectDetail, error) {
	return s.repo.GetProjectDetail(ctx, judgeID, projectID)
}

func (s *JudgeService) MyVote(ctx context.Context, judgeID string, projectID string) (models.Vote, error) {
	return s.repo.GetMyVote(ctx, judgeID, projectID)
}

func (s *JudgeService) SubmitVote(ctx context.Context, judgeID string, projectID string, payload models.VoteSubmissionRequest) (models.Vote, error) {
	detail, err := s.repo.GetProjectDetail(ctx, judgeID, projectID)
	if err != nil {
		return models.Vote{}, err
	}

	if len(detail.Criteria) == 0 {
		return models.Vote{}, errors.New("no active criteria configured for this category")
	}

	if len(payload.Scores) != len(detail.Criteria) {
		return models.Vote{}, errors.New("vote must include scores for all active criteria")
	}

	criterionByID := map[string]models.ScoringCriterion{}
	for _, criterion := range detail.Criteria {
		criterionByID[criterion.ID] = criterion
	}

	totalScore := 0
	seen := map[string]struct{}{}
	for _, score := range payload.Scores {
		criterion, exists := criterionByID[score.CriterionID]
		if !exists {
			return models.Vote{}, errors.New("one or more criteria are invalid for this project")
		}
		if _, duplicated := seen[score.CriterionID]; duplicated {
			return models.Vote{}, errors.New("duplicate criterion score submitted")
		}
		seen[score.CriterionID] = struct{}{}
		if score.Score < 0 || score.Score > criterion.MaxScore {
			return models.Vote{}, errors.New("score must be between 0 and the criterion max score")
		}
		totalScore += score.Score
	}

	return s.repo.UpsertVote(ctx, judgeID, detail.Project, totalScore, payload.Scores)
}

func (s *JudgeService) Summary(ctx context.Context, judgeID string, categoryID string) ([]models.JudgeSummaryRow, error) {
	return s.repo.GetSummary(ctx, judgeID, categoryID)
}
