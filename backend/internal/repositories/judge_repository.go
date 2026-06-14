package repositories

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"creativexvoting/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type JudgeRepository struct {
	pool *pgxpool.Pool
}

func NewJudgeRepository(pool *pgxpool.Pool) *JudgeRepository {
	return &JudgeRepository{pool: pool}
}

func (r *JudgeRepository) ListAssignedCategories(ctx context.Context, judgeID string) ([]models.Category, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT c.id, c.name, c.description, c.is_active, c.created_at, c.updated_at
		FROM judge_category_assignments a
		JOIN categories c ON c.id = a.category_id
		JOIN users u ON u.id = a.judge_id
		WHERE a.judge_id = $1 AND c.is_active = TRUE AND u.is_active = TRUE
		ORDER BY c.name
	`, judgeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []models.Category
	for rows.Next() {
		var category models.Category
		if err := rows.Scan(&category.ID, &category.Name, &category.Description, &category.IsActive, &category.CreatedAt, &category.UpdatedAt); err != nil {
			return nil, err
		}
		categories = append(categories, category)
	}

	return categories, rows.Err()
}

func (r *JudgeRepository) ListProjects(ctx context.Context, judgeID string, categoryID string) ([]models.JudgeProjectCard, error) {
	args := []any{judgeID}
	conditions := []string{"a.judge_id = $1", "p.is_active = TRUE", "c.is_active = TRUE"}

	if categoryID != "" {
		args = append(args, categoryID)
		conditions = append(conditions, fmt.Sprintf("p.category_id = $%d", len(args)))
	}

	query := fmt.Sprintf(`
		SELECT
			p.id, p.category_id, p.title, p.short_description, p.designer_name, p.team_name, p.image_url,
			(v.id IS NOT NULL) AS has_voted,
			v.total_score,
			c.name
		FROM judge_category_assignments a
		JOIN categories c ON c.id = a.category_id
		JOIN projects p ON p.category_id = c.id
		LEFT JOIN votes v ON v.project_id = p.id AND v.judge_id = a.judge_id
		WHERE %s
		ORDER BY p.title
	`, strings.Join(conditions, " AND "))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []models.JudgeProjectCard
	for rows.Next() {
		var project models.JudgeProjectCard
		var currentScore *int
		if err := rows.Scan(
			&project.ID,
			&project.CategoryID,
			&project.Title,
			&project.ShortDescription,
			&project.DesignerName,
			&project.TeamName,
			&project.ImageURL,
			&project.HasVoted,
			&currentScore,
			&project.CategoryName,
		); err != nil {
			return nil, err
		}
		project.CurrentScore = currentScore
		projects = append(projects, project)
	}

	return projects, rows.Err()
}

func (r *JudgeRepository) GetProjectDetail(ctx context.Context, judgeID string, projectID string) (models.JudgeProjectDetail, error) {
	var detail models.JudgeProjectDetail

	rows, err := r.pool.Query(ctx, `
		SELECT
			p.id, p.category_id, c.name, p.title, p.short_description, p.full_description, p.concept,
			p.designer_name, p.team_name, p.image_url, p.proposal_link, p.social_media_link,
			p.drive_link, p.attached_file_link, p.extra_details, p.is_active, p.created_at, p.updated_at
		FROM projects p
		JOIN categories c ON c.id = p.category_id
		JOIN judge_category_assignments a ON a.category_id = p.category_id AND a.judge_id = $1
		WHERE p.id = $2 AND p.is_active = TRUE AND c.is_active = TRUE
	`, judgeID, projectID)
	if err != nil {
		return detail, err
	}
	defer rows.Close()

	if rows.Next() {
		project, err := scanProject(rows)
		if err != nil {
			return detail, err
		}
		detail.Project = project
	} else {
		return detail, pgx.ErrNoRows
	}

	criteriaRows, err := r.pool.Query(ctx, `
		SELECT id, category_id, name, description, max_score, display_order, is_active, created_at, updated_at
		FROM scoring_criteria
		WHERE category_id = $1 AND is_active = TRUE
		ORDER BY display_order, created_at
	`, detail.Project.CategoryID)
	if err != nil {
		return detail, err
	}
	defer criteriaRows.Close()

	for criteriaRows.Next() {
		var criterion models.ScoringCriterion
		if err := criteriaRows.Scan(
			&criterion.ID,
			&criterion.CategoryID,
			&criterion.Name,
			&criterion.Description,
			&criterion.MaxScore,
			&criterion.DisplayOrder,
			&criterion.IsActive,
			&criterion.CreatedAt,
			&criterion.UpdatedAt,
		); err != nil {
			return detail, err
		}
		detail.Criteria = append(detail.Criteria, criterion)
	}

	return detail, criteriaRows.Err()
}

func (r *JudgeRepository) GetMyVote(ctx context.Context, judgeID string, projectID string) (models.Vote, error) {
	var vote models.Vote
	var submittedAt sql.NullTime

	err := r.pool.QueryRow(ctx, `
		SELECT id, judge_id, project_id, total_score, submitted_at, created_at, updated_at
		FROM votes
		WHERE judge_id = $1 AND project_id = $2
	`, judgeID, projectID).Scan(&vote.ID, &vote.JudgeID, &vote.ProjectID, &vote.TotalScore, &submittedAt, &vote.CreatedAt, &vote.UpdatedAt)
	if err != nil {
		return vote, err
	}

	if submittedAt.Valid {
		vote.SubmittedAt = &submittedAt.Time
	}

	rows, err := r.pool.Query(ctx, `
		SELECT id, vote_id, criterion_id, score, created_at, updated_at
		FROM vote_scores
		WHERE vote_id = $1
		ORDER BY criterion_id
	`, vote.ID)
	if err != nil {
		return vote, err
	}
	defer rows.Close()

	for rows.Next() {
		var score models.VoteCriterionScore
		if err := rows.Scan(&score.ID, &score.VoteID, &score.CriterionID, &score.Score, &score.CreatedAt, &score.UpdatedAt); err != nil {
			return vote, err
		}
		vote.Scores = append(vote.Scores, score)
	}

	return vote, rows.Err()
}

func (r *JudgeRepository) UpsertVote(ctx context.Context, judgeID string, project models.Project, totalScore int, scores []models.VoteCriterionInput) (models.Vote, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return models.Vote{}, err
	}
	defer tx.Rollback(ctx)

	var vote models.Vote
	var existingID string
	var oldTotal int
	var existingCreatedAt time.Time
	err = tx.QueryRow(ctx, `
		SELECT id, total_score, created_at, submitted_at
		FROM votes
		WHERE judge_id = $1 AND project_id = $2
	`, judgeID, project.ID).Scan(&existingID, &oldTotal, &existingCreatedAt, new(sql.NullTime))

	now := time.Now()
	if err != nil && err != pgx.ErrNoRows {
		return vote, err
	}

	if err == pgx.ErrNoRows {
		vote = models.Vote{
			ID:         uuid.NewString(),
			JudgeID:    judgeID,
			ProjectID:  project.ID,
			TotalScore: totalScore,
			CreatedAt:  now,
			UpdatedAt:  now,
			SubmittedAt: &now,
		}
		if _, err = tx.Exec(ctx, `
			INSERT INTO votes (id, judge_id, project_id, total_score, submitted_at, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		`, vote.ID, vote.JudgeID, vote.ProjectID, vote.TotalScore, vote.SubmittedAt); err != nil {
			return vote, err
		}
	} else {
		vote = models.Vote{
			ID:         existingID,
			JudgeID:    judgeID,
			ProjectID:  project.ID,
			TotalScore: totalScore,
			CreatedAt:  existingCreatedAt,
			UpdatedAt:  now,
			SubmittedAt: &now,
		}
		if _, err = tx.Exec(ctx, `
			UPDATE votes
			SET total_score = $2, submitted_at = $3, updated_at = NOW()
			WHERE id = $1
		`, vote.ID, vote.TotalScore, vote.SubmittedAt); err != nil {
			return vote, err
		}

		if _, err = tx.Exec(ctx, `DELETE FROM vote_scores WHERE vote_id = $1`, vote.ID); err != nil {
			return vote, err
		}

		if _, err = tx.Exec(ctx, `
			INSERT INTO vote_audit_logs (id, vote_id, judge_id, project_id, old_total_score, new_total_score, changed_at)
			VALUES ($1, $2, $3, $4, $5, $6, NOW())
		`, uuid.NewString(), vote.ID, judgeID, project.ID, oldTotal, totalScore); err != nil {
			return vote, err
		}
	}

	for _, score := range scores {
		if _, err = tx.Exec(ctx, `
			INSERT INTO vote_scores (id, vote_id, criterion_id, score, created_at, updated_at)
			VALUES ($1, $2, $3, $4, NOW(), NOW())
		`, uuid.NewString(), vote.ID, score.CriterionID, score.Score); err != nil {
			return vote, err
		}

		vote.Scores = append(vote.Scores, models.VoteCriterionScore{
			ID:          uuid.NewString(),
			VoteID:      vote.ID,
			CriterionID: score.CriterionID,
			Score:       score.Score,
			CreatedAt:   now,
			UpdatedAt:   now,
		})
	}

	if err = tx.Commit(ctx); err != nil {
		return vote, err
	}

	return vote, nil
}

func (r *JudgeRepository) GetSummary(ctx context.Context, judgeID string, categoryID string) ([]models.JudgeSummaryRow, error) {
	args := []any{judgeID}
	conditions := []string{"a.judge_id = $1"}

	if categoryID != "" {
		args = append(args, categoryID)
		conditions = append(conditions, fmt.Sprintf("p.category_id = $%d", len(args)))
	}

	query := fmt.Sprintf(`
		SELECT
			p.id,
			p.title,
			p.category_id,
			COALESCE(v.total_score, 0) AS total_score,
			(v.id IS NOT NULL) AS has_voted
		FROM judge_category_assignments a
		JOIN projects p ON p.category_id = a.category_id AND p.is_active = TRUE
		LEFT JOIN votes v ON v.project_id = p.id AND v.judge_id = a.judge_id
		WHERE %s
		ORDER BY COALESCE(v.total_score, 0) DESC, p.title
	`, strings.Join(conditions, " AND "))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summary []models.JudgeSummaryRow
	rank := 1
	for rows.Next() {
		var row models.JudgeSummaryRow
		if err := rows.Scan(&row.ProjectID, &row.ProjectName, &row.CategoryID, &row.TotalScore, &row.HasVoted); err != nil {
			return nil, err
		}
		row.Ranking = rank
		summary = append(summary, row)
		rank++
	}

	return summary, rows.Err()
}
