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

type AdminRepository struct {
	pool *pgxpool.Pool
}

func NewAdminRepository(pool *pgxpool.Pool) *AdminRepository {
	return &AdminRepository{pool: pool}
}

func (r *AdminRepository) GetDashboardStats(ctx context.Context) (models.DashboardStats, error) {
	var stats models.DashboardStats

	query := `
		WITH possible_votes AS (
			SELECT COUNT(*) AS total
			FROM judge_group_assignments a
			JOIN users u ON u.id = a.judge_id AND u.role = 'judge' AND u.is_active = TRUE
			JOIN categories c ON c.award_group_id = a.group_id AND c.is_active = TRUE
			JOIN projects p ON p.category_id = c.id AND p.is_active = TRUE
		)
		SELECT
			(SELECT COUNT(*) FROM projects WHERE is_active = TRUE),
			(SELECT COUNT(*) FROM users WHERE role = 'judge' AND is_active = TRUE),
			(SELECT COUNT(*) FROM categories WHERE is_active = TRUE),
			(SELECT COUNT(*) FROM votes),
			COALESCE((SELECT total FROM possible_votes), 0)
	`

	if err := r.pool.QueryRow(ctx, query).Scan(
		&stats.TotalProjects,
		&stats.TotalJudges,
		&stats.TotalCategories,
		&stats.TotalVotesSubmitted,
		&stats.PossibleVoteCount,
	); err != nil {
		return stats, err
	}

	if stats.PossibleVoteCount > 0 {
		stats.CompletionPercentage = float64(stats.TotalVotesSubmitted) / float64(stats.PossibleVoteCount) * 100
	}

	return stats, nil
}

func (r *AdminRepository) ListAwardGroups(ctx context.Context) ([]models.AwardGroup, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, code, name, COALESCE(name_th, ''), description, COALESCE(description_th, ''), display_order, is_active, created_at, updated_at
		FROM award_groups
		ORDER BY display_order, code, name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []models.AwardGroup
	for rows.Next() {
		var group models.AwardGroup
		if err := rows.Scan(&group.ID, &group.Code, &group.Name, &group.NameTh, &group.Description, &group.DescriptionTh, &group.DisplayOrder, &group.IsActive, &group.CreatedAt, &group.UpdatedAt); err != nil {
			return nil, err
		}
		groups = append(groups, group)
	}

	return groups, rows.Err()
}

func (r *AdminRepository) ListCategories(ctx context.Context) ([]models.Category, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, award_group_id, name, COALESCE(name_th, ''), description, COALESCE(description_th, ''), display_order, is_active, created_at, updated_at
		FROM categories
		ORDER BY is_active DESC, display_order, created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []models.Category
	for rows.Next() {
		var category models.Category
		if err := rows.Scan(&category.ID, &category.AwardGroupID, &category.Name, &category.NameTh, &category.Description, &category.DescriptionTh, &category.DisplayOrder, &category.IsActive, &category.CreatedAt, &category.UpdatedAt); err != nil {
			return nil, err
		}
		categories = append(categories, category)
	}

	return categories, rows.Err()
}

func (r *AdminRepository) CreateCategory(ctx context.Context, payload models.CategoryPayload) (models.Category, error) {
	category := models.Category{
		ID:            uuid.NewString(),
		AwardGroupID:  payload.AwardGroupID,
		Name:          payload.Name,
		NameTh:        payload.NameTh,
		Description:   payload.Description,
		DescriptionTh: payload.DescriptionTh,
		DisplayOrder:  payload.DisplayOrder,
		IsActive:      payload.IsActive,
	}

	err := r.pool.QueryRow(ctx, `
		INSERT INTO categories (id, award_group_id, name, name_th, description, description_th, display_order, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
		RETURNING created_at, updated_at
	`, category.ID, category.AwardGroupID, category.Name, category.NameTh, category.Description, category.DescriptionTh, category.DisplayOrder, category.IsActive).Scan(&category.CreatedAt, &category.UpdatedAt)

	return category, err
}

func (r *AdminRepository) UpdateCategory(ctx context.Context, id string, payload models.CategoryPayload) (models.Category, error) {
	category := models.Category{
		ID:            id,
		AwardGroupID:  payload.AwardGroupID,
		Name:          payload.Name,
		NameTh:        payload.NameTh,
		Description:   payload.Description,
		DescriptionTh: payload.DescriptionTh,
		DisplayOrder:  payload.DisplayOrder,
		IsActive:      payload.IsActive,
	}

	err := r.pool.QueryRow(ctx, `
		UPDATE categories
		SET award_group_id = $2, name = $3, name_th = $4, description = $5, description_th = $6, display_order = $7, is_active = $8, updated_at = NOW()
		WHERE id = $1
		RETURNING created_at, updated_at
	`, id, category.AwardGroupID, category.Name, category.NameTh, category.Description, category.DescriptionTh, category.DisplayOrder, category.IsActive).Scan(&category.CreatedAt, &category.UpdatedAt)

	return category, err
}

func (r *AdminRepository) SoftDeleteCategory(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `UPDATE categories SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, id)
	return err
}

func (r *AdminRepository) ListProjects(ctx context.Context, categoryID string, search string) ([]models.Project, error) {
	conditions := []string{"1=1"}
	args := []any{}

	if categoryID != "" {
		args = append(args, categoryID)
		conditions = append(conditions, fmt.Sprintf("p.category_id = $%d", len(args)))
	}

	if search != "" {
		args = append(args, "%"+strings.ToLower(search)+"%")
		index := len(args)
		conditions = append(conditions, fmt.Sprintf("(LOWER(p.title) LIKE $%d OR LOWER(COALESCE(p.team_name, '')) LIKE $%d OR LOWER(COALESCE(p.designer_name, '')) LIKE $%d)", index, index, index))
	}

	query := fmt.Sprintf(`
		SELECT
			p.id, p.category_id, c.name, p.title, p.short_description, p.full_description, p.concept,
			p.designer_name, p.team_name, p.image_url, p.social_media_link,
			p.drive_link, p.extra_details, p.is_active, p.created_at, p.updated_at
		FROM projects p
		JOIN categories c ON c.id = p.category_id
		WHERE %s
		ORDER BY p.created_at DESC
	`, strings.Join(conditions, " AND "))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []models.Project
	for rows.Next() {
		project, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		projects = append(projects, project)
	}

	return projects, rows.Err()
}

func (r *AdminRepository) CreateProject(ctx context.Context, payload models.ProjectPayload) (models.Project, error) {
	project := models.Project{
		ID:               uuid.NewString(),
		CategoryID:       payload.CategoryID,
		Title:            payload.Title,
		ShortDescription: payload.ShortDescription,
		FullDescription:  payload.FullDescription,
		Concept:          payload.Concept,
		DesignerName:     payload.DesignerName,
		TeamName:         payload.TeamName,
		ImageURL:         payload.ImageURL,
		SocialMediaLink:  payload.SocialMediaLink,
		DriveLink:        payload.DriveLink,
		ExtraDetails:     payload.ExtraDetails,
		IsActive:         payload.IsActive,
	}

	err := r.pool.QueryRow(ctx, `
		INSERT INTO projects (
			id, category_id, title, short_description, full_description, concept, designer_name, team_name,
			image_url, social_media_link, drive_link, extra_details,
			is_active, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
		RETURNING created_at, updated_at
	`, project.ID, project.CategoryID, project.Title, project.ShortDescription, project.FullDescription, project.Concept,
		project.DesignerName, project.TeamName, project.ImageURL, project.SocialMediaLink,
		project.DriveLink, project.ExtraDetails, project.IsActive,
	).Scan(&project.CreatedAt, &project.UpdatedAt)

	return project, err
}

// UpdateProject updates a project and returns the project's previous
// image_url (captured before the update) so the caller can clean up the old
// file on disk if it was replaced or removed.
func (r *AdminRepository) UpdateProject(ctx context.Context, id string, payload models.ProjectPayload) (models.Project, string, error) {
	project := models.Project{
		ID:               id,
		CategoryID:       payload.CategoryID,
		Title:            payload.Title,
		ShortDescription: payload.ShortDescription,
		FullDescription:  payload.FullDescription,
		Concept:          payload.Concept,
		DesignerName:     payload.DesignerName,
		TeamName:         payload.TeamName,
		ImageURL:         payload.ImageURL,
		SocialMediaLink:  payload.SocialMediaLink,
		DriveLink:        payload.DriveLink,
		ExtraDetails:     payload.ExtraDetails,
		IsActive:         payload.IsActive,
	}

	var previousImageURL string
	err := r.pool.QueryRow(ctx, `
		WITH old AS (SELECT image_url FROM projects WHERE id = $1)
		UPDATE projects
		SET category_id = $2, title = $3, short_description = $4, full_description = $5, concept = $6,
			designer_name = $7, team_name = $8, image_url = $9, social_media_link = $10,
			drive_link = $11, extra_details = $12, is_active = $13, updated_at = NOW()
		WHERE id = $1
		RETURNING created_at, updated_at, (SELECT image_url FROM old)
	`, project.ID, project.CategoryID, project.Title, project.ShortDescription, project.FullDescription, project.Concept,
		project.DesignerName, project.TeamName, project.ImageURL, project.SocialMediaLink,
		project.DriveLink, project.ExtraDetails, project.IsActive,
	).Scan(&project.CreatedAt, &project.UpdatedAt, &previousImageURL)

	return project, previousImageURL, err
}

func (r *AdminRepository) SoftDeleteProject(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `UPDATE projects SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, id)
	return err
}

func (r *AdminRepository) ListCriteria(ctx context.Context, categoryID string) ([]models.ScoringCriterion, error) {
	args := []any{}
	conditions := []string{"1=1"}

	if categoryID != "" {
		args = append(args, categoryID)
		conditions = append(conditions, fmt.Sprintf("category_id = $%d", len(args)))
	}

	query := fmt.Sprintf(`
		SELECT id, category_id, name, COALESCE(name_th, ''), description, COALESCE(description_th, ''), max_score, display_order, is_active, created_at, updated_at
		FROM scoring_criteria
		WHERE %s
		ORDER BY category_id, display_order, created_at
	`, strings.Join(conditions, " AND "))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var criteria []models.ScoringCriterion
	for rows.Next() {
		var criterion models.ScoringCriterion
		if err := rows.Scan(
			&criterion.ID,
			&criterion.CategoryID,
			&criterion.Name,
			&criterion.NameTh,
			&criterion.Description,
			&criterion.DescriptionTh,
			&criterion.MaxScore,
			&criterion.DisplayOrder,
			&criterion.IsActive,
			&criterion.CreatedAt,
			&criterion.UpdatedAt,
		); err != nil {
			return nil, err
		}
		criteria = append(criteria, criterion)
	}

	return criteria, rows.Err()
}

func (r *AdminRepository) CreateCriterion(ctx context.Context, payload models.CriterionPayload) (models.ScoringCriterion, error) {
	criterion := models.ScoringCriterion{
		ID:            uuid.NewString(),
		CategoryID:    payload.CategoryID,
		Name:          payload.Name,
		NameTh:        payload.NameTh,
		Description:   payload.Description,
		DescriptionTh: payload.DescriptionTh,
		MaxScore:      payload.MaxScore,
		DisplayOrder:  payload.DisplayOrder,
		IsActive:      payload.IsActive,
	}

	err := r.pool.QueryRow(ctx, `
		INSERT INTO scoring_criteria (
			id, category_id, name, name_th, description, description_th, max_score, display_order, is_active, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		RETURNING created_at, updated_at
	`, criterion.ID, criterion.CategoryID, criterion.Name, criterion.NameTh, criterion.Description, criterion.DescriptionTh, criterion.MaxScore, criterion.DisplayOrder, criterion.IsActive).Scan(&criterion.CreatedAt, &criterion.UpdatedAt)

	return criterion, err
}

func (r *AdminRepository) UpdateCriterion(ctx context.Context, id string, payload models.CriterionPayload) (models.ScoringCriterion, error) {
	criterion := models.ScoringCriterion{
		ID:            id,
		CategoryID:    payload.CategoryID,
		Name:          payload.Name,
		NameTh:        payload.NameTh,
		Description:   payload.Description,
		DescriptionTh: payload.DescriptionTh,
		MaxScore:      payload.MaxScore,
		DisplayOrder:  payload.DisplayOrder,
		IsActive:      payload.IsActive,
	}

	err := r.pool.QueryRow(ctx, `
		UPDATE scoring_criteria
		SET category_id = $2, name = $3, name_th = $4, description = $5, description_th = $6,
			max_score = $7, display_order = $8, is_active = $9, updated_at = NOW()
		WHERE id = $1
		RETURNING created_at, updated_at
	`, criterion.ID, criterion.CategoryID, criterion.Name, criterion.NameTh, criterion.Description, criterion.DescriptionTh, criterion.MaxScore, criterion.DisplayOrder, criterion.IsActive).Scan(&criterion.CreatedAt, &criterion.UpdatedAt)

	return criterion, err
}

func (r *AdminRepository) SoftDeleteCriterion(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `UPDATE scoring_criteria SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, id)
	return err
}

func (r *AdminRepository) ListJudges(ctx context.Context) ([]models.User, error) {
	rows, err := r.pool.Query(ctx, `
		WITH assigned_projects AS (
			SELECT
				a.judge_id,
				COUNT(DISTINCT p.id) AS assigned_count
			FROM judge_group_assignments a
			JOIN categories c ON c.award_group_id = a.group_id AND c.is_active = TRUE
			JOIN projects p ON p.category_id = c.id AND p.is_active = TRUE
			GROUP BY a.judge_id
		),
		submitted_votes AS (
			SELECT
				v.judge_id,
				COUNT(DISTINCT v.project_id) AS scored_count
			FROM votes v
			WHERE v.submitted_at IS NOT NULL
			GROUP BY v.judge_id
		)
		SELECT
			u.id,
			u.username,
			u.display_name,
			u.password_hash,
			u.role,
			u.is_active,
			CASE
				WHEN u.role = 'judge' AND u.is_active = TRUE THEN COALESCE(sv.scored_count, 0)
				ELSE 0
			END AS scored_count,
			CASE
				WHEN u.role = 'judge' AND u.is_active = TRUE THEN COALESCE(ap.assigned_count, 0)
				ELSE 0
			END AS assigned_count,
			u.created_at,
			u.updated_at
		FROM users u
		LEFT JOIN assigned_projects ap ON ap.judge_id = u.id
		LEFT JOIN submitted_votes sv ON sv.judge_id = u.id
		ORDER BY u.role, u.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		if err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.DisplayName,
			&user.PasswordHash,
			&user.Role,
			&user.IsActive,
			&user.ScoredCount,
			&user.AssignedCount,
			&user.CreatedAt,
			&user.UpdatedAt,
		); err != nil {
			return nil, err
		}
		users = append(users, user)
	}

	return users, rows.Err()
}

func (r *AdminRepository) CreateJudge(ctx context.Context, payload models.JudgePayload, passwordHash string) (models.User, error) {
	user := models.User{
		ID:           uuid.NewString(),
		Username:     payload.Username,
		DisplayName:  payload.DisplayName,
		PasswordHash: passwordHash,
		Role:         payload.Role,
		IsActive:     payload.IsActive,
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return user, err
	}
	defer tx.Rollback(ctx)

	if err = tx.QueryRow(ctx, `
		INSERT INTO users (id, username, password_hash, display_name, role, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
		RETURNING created_at, updated_at
	`, user.ID, user.Username, user.PasswordHash, user.DisplayName, user.Role, user.IsActive).Scan(&user.CreatedAt, &user.UpdatedAt); err != nil {
		return user, err
	}

	if err = r.replaceAssignmentsTx(ctx, tx, user.ID, payload.GroupIDs); err != nil {
		return user, err
	}

	return user, tx.Commit(ctx)
}

func (r *AdminRepository) UpdateJudge(ctx context.Context, id string, payload models.JudgePayload) (models.User, error) {
	user := models.User{
		ID:          id,
		Username:    payload.Username,
		DisplayName: payload.DisplayName,
		Role:        payload.Role,
		IsActive:    payload.IsActive,
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return user, err
	}
	defer tx.Rollback(ctx)

	if err = tx.QueryRow(ctx, `
		UPDATE users
		SET username = $2, display_name = $3, role = $4, is_active = $5, updated_at = NOW()
		WHERE id = $1
		RETURNING created_at, updated_at
	`, user.ID, user.Username, user.DisplayName, user.Role, user.IsActive).Scan(&user.CreatedAt, &user.UpdatedAt); err != nil {
		return user, err
	}

	if err = r.replaceAssignmentsTx(ctx, tx, user.ID, payload.GroupIDs); err != nil {
		return user, err
	}

	return user, tx.Commit(ctx)
}

func (r *AdminRepository) ResetPassword(ctx context.Context, id string, passwordHash string) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, id, passwordHash)
	return err
}

func (r *AdminRepository) SoftDeleteJudge(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, id)
	return err
}

func (r *AdminRepository) GetJudgeGroupIDs(ctx context.Context, judgeID string) ([]string, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT group_id
		FROM judge_group_assignments
		WHERE judge_id = $1
		ORDER BY group_id
	`, judgeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (r *AdminRepository) ReplaceJudgeAssignments(ctx context.Context, judgeID string, groupIDs []string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err = r.replaceAssignmentsTx(ctx, tx, judgeID, groupIDs); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *AdminRepository) DeleteJudgeAssignment(ctx context.Context, judgeID string, groupID string) error {
	_, err := r.pool.Exec(ctx, `
		DELETE FROM judge_group_assignments
		WHERE judge_id = $1 AND group_id = $2
	`, judgeID, groupID)
	return err
}

func (r *AdminRepository) GetResults(ctx context.Context, categoryID string, judgeID string) (models.ResultsResponse, error) {
	rankings, err := r.getProjectRankings(ctx, categoryID, judgeID)
	if err != nil {
		return models.ResultsResponse{}, err
	}

	judgeVotes, err := r.getJudgeVoteRows(ctx, categoryID, judgeID)
	if err != nil {
		return models.ResultsResponse{}, err
	}

	return models.ResultsResponse{
		Rankings:   rankings,
		JudgeVotes: judgeVotes,
	}, nil
}

func (r *AdminRepository) GetProjectVoteDetail(ctx context.Context, projectID string) (models.ProjectVoteDetail, error) {
	var detail models.ProjectVoteDetail

	projectRows, err := r.pool.Query(ctx, `
		SELECT
			p.id, p.category_id, c.name, p.title, p.short_description, p.full_description, p.concept,
			p.designer_name, p.team_name, p.image_url, p.social_media_link,
			p.drive_link, p.extra_details, p.is_active, p.created_at, p.updated_at
		FROM projects p
		JOIN categories c ON c.id = p.category_id
		WHERE p.id = $1
	`, projectID)
	if err != nil {
		return detail, err
	}
	defer projectRows.Close()

	if projectRows.Next() {
		project, err := scanProject(projectRows)
		if err != nil {
			return detail, err
		}
		detail.Project = project
	} else {
		return detail, pgx.ErrNoRows
	}

	rows, err := r.pool.Query(ctx, `
		SELECT
			v.id, u.id, u.display_name, v.total_score, v.submitted_at,
			sc.id, sc.name, sc.max_score, vs.score
		FROM votes v
		JOIN users u ON u.id = v.judge_id AND u.role = 'judge' AND u.is_active = TRUE
		JOIN vote_scores vs ON vs.vote_id = v.id
		JOIN scoring_criteria sc ON sc.id = vs.criterion_id
		WHERE v.project_id = $1
		ORDER BY v.total_score DESC, u.display_name, sc.display_order
	`, projectID)
	if err != nil {
		return detail, err
	}
	defer rows.Close()

	byVote := map[string]*models.ProjectJudgeVoteRow{}
	order := []string{}

	for rows.Next() {
		var voteID, judgeIDValue, judgeName, criterionID, criterionName string
		var totalScore, maxScore, score int
		var submitted sql.NullTime
		if err := rows.Scan(&voteID, &judgeIDValue, &judgeName, &totalScore, &submitted, &criterionID, &criterionName, &maxScore, &score); err != nil {
			return detail, err
		}

		row, exists := byVote[voteID]
		if !exists {
			var submittedPointer *time.Time
			if submitted.Valid {
				submittedPointer = &submitted.Time
			}
			row = &models.ProjectJudgeVoteRow{
				VoteID:      voteID,
				JudgeID:     judgeIDValue,
				JudgeName:   judgeName,
				TotalScore:  totalScore,
				SubmittedAt: submittedPointer,
			}
			byVote[voteID] = row
			order = append(order, voteID)
			detail.CombinedScore += totalScore
		}

		row.Scores = append(row.Scores, models.ProjectCriterionRow{
			CriterionID:   criterionID,
			CriterionName: criterionName,
			MaxScore:      maxScore,
			Score:         score,
		})
	}

	for _, voteID := range order {
		detail.JudgeVotes = append(detail.JudgeVotes, *byVote[voteID])
	}

	return detail, rows.Err()
}

func (r *AdminRepository) ExportResults(ctx context.Context, categoryID string, judgeID string) ([]models.CSVExportRow, error) {
	conditions := []string{"1=1"}
	args := []any{}

	if categoryID != "" {
		args = append(args, categoryID)
		conditions = append(conditions, fmt.Sprintf("p.category_id = $%d", len(args)))
	}
	if judgeID != "" {
		args = append(args, judgeID)
		conditions = append(conditions, fmt.Sprintf("u.id = $%d", len(args)))
	}

	query := fmt.Sprintf(`
		WITH project_aggregates AS (
			SELECT v.project_id, COALESCE(SUM(v.total_score), 0) AS overall_total, COALESCE(AVG(v.total_score), 0) AS average_score
			FROM votes v
			JOIN users u ON u.id = v.judge_id AND u.role = 'judge' AND u.is_active = TRUE
			GROUP BY project_id
		)
		SELECT
			c.name,
			p.title,
			u.display_name,
			sc.name,
			vs.score,
			v.total_score,
			COALESCE(pa.overall_total, 0),
			COALESCE(pa.average_score, 0)
		FROM votes v
		JOIN users u ON u.id = v.judge_id AND u.role = 'judge' AND u.is_active = TRUE
		JOIN projects p ON p.id = v.project_id
		JOIN categories c ON c.id = p.category_id
		JOIN vote_scores vs ON vs.vote_id = v.id
		JOIN scoring_criteria sc ON sc.id = vs.criterion_id
		LEFT JOIN project_aggregates pa ON pa.project_id = p.id
		WHERE %s
		ORDER BY c.name, p.title, u.display_name, sc.display_order
	`, strings.Join(conditions, " AND "))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var exportRows []models.CSVExportRow
	for rows.Next() {
		var row models.CSVExportRow
		if err := rows.Scan(
			&row.Category,
			&row.ProjectTitle,
			&row.JudgeName,
			&row.CriterionName,
			&row.CriterionScore,
			&row.ProjectTotalByJudge,
			&row.ProjectTotalOverall,
			&row.AverageScore,
		); err != nil {
			return nil, err
		}
		exportRows = append(exportRows, row)
	}

	return exportRows, rows.Err()
}

func (r *AdminRepository) replaceAssignmentsTx(ctx context.Context, tx pgx.Tx, judgeID string, groupIDs []string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM judge_group_assignments WHERE judge_id = $1`, judgeID); err != nil {
		return err
	}

	seen := map[string]struct{}{}
	for _, groupID := range groupIDs {
		if groupID == "" {
			continue
		}
		if _, exists := seen[groupID]; exists {
			continue
		}
		seen[groupID] = struct{}{}

		if _, err := tx.Exec(ctx, `
			INSERT INTO judge_group_assignments (id, judge_id, group_id, created_at)
			VALUES ($1, $2, $3, NOW())
		`, uuid.NewString(), judgeID, groupID); err != nil {
			return err
		}
	}

	return nil
}

func (r *AdminRepository) getProjectRankings(ctx context.Context, categoryID string, judgeID string) ([]models.AdminProjectRanking, error) {
	args := []any{}
	conditions := []string{"1=1"}
	voteConditions := []string{"1=1"}

	if categoryID != "" {
		args = append(args, categoryID)
		conditions = append(conditions, fmt.Sprintf("p.category_id = $%d", len(args)))
		voteConditions = append(voteConditions, fmt.Sprintf("p.category_id = $%d", len(args)))
	}

	if judgeID != "" {
		args = append(args, judgeID)
		voteConditions = append(voteConditions, fmt.Sprintf("v.judge_id = $%d", len(args)))
	}

	query := fmt.Sprintf(`
		WITH judge_counts AS (
			SELECT c.id AS category_id, COUNT(ju.id) AS assigned_judges
			FROM categories c
			LEFT JOIN judge_group_assignments a ON a.group_id = c.award_group_id
			LEFT JOIN users ju ON ju.id = a.judge_id AND ju.role = 'judge' AND ju.is_active = TRUE
			GROUP BY c.id
		),
		aggregates AS (
			SELECT
				p.id AS project_id,
				COALESCE(SUM(CASE WHEN u.id IS NOT NULL THEN v.total_score ELSE 0 END), 0) AS total_score,
				COALESCE(AVG(CASE WHEN u.id IS NOT NULL THEN v.total_score END), 0) AS average_score,
				COUNT(u.id) AS submitted_votes
			FROM projects p
			LEFT JOIN votes v ON v.project_id = p.id AND v.submitted_at IS NOT NULL
			LEFT JOIN users u ON u.id = v.judge_id AND u.role = 'judge' AND u.is_active = TRUE
			WHERE %s
			GROUP BY p.id
		)
		SELECT
			p.id,
			p.title,
			p.category_id,
			c.name,
			a.total_score,
			a.average_score,
			a.submitted_votes,
			COALESCE(
				CASE WHEN jc.assigned_judges > 0
					THEN (a.submitted_votes::DECIMAL / jc.assigned_judges::DECIMAL) * 100
					ELSE 0
				END,
				0
			) AS completion_percent
		FROM projects p
		JOIN categories c ON c.id = p.category_id
		JOIN aggregates a ON a.project_id = p.id
		LEFT JOIN judge_counts jc ON jc.category_id = p.category_id
		WHERE %s
		ORDER BY a.total_score DESC, a.average_score DESC, p.title
	`, strings.Join(voteConditions, " AND "), strings.Join(conditions, " AND "))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rankings []models.AdminProjectRanking
	index := 1
	for rows.Next() {
		var item models.AdminProjectRanking
		if err := rows.Scan(
			&item.ProjectID,
			&item.ProjectName,
			&item.CategoryID,
			&item.Category,
			&item.TotalScore,
			&item.AverageScore,
			&item.SubmittedVotes,
			&item.CompletionPercent,
		); err != nil {
			return nil, err
		}
		item.Ranking = index
		rankings = append(rankings, item)
		index++
	}

	return rankings, rows.Err()
}

func (r *AdminRepository) getJudgeVoteRows(ctx context.Context, categoryID string, judgeID string) ([]models.AdminJudgeVoteRow, error) {
	args := []any{}
	conditions := []string{"1=1"}

	if categoryID != "" {
		args = append(args, categoryID)
		conditions = append(conditions, fmt.Sprintf("p.category_id = $%d", len(args)))
	}
	if judgeID != "" {
		args = append(args, judgeID)
		conditions = append(conditions, fmt.Sprintf("u.id = $%d", len(args)))
	}

	query := fmt.Sprintf(`
		SELECT
			v.id, p.id, p.title, c.name, u.id, u.display_name, v.total_score, v.submitted_at
		FROM votes v
		JOIN users u ON u.id = v.judge_id AND u.role = 'judge' AND u.is_active = TRUE
		JOIN projects p ON p.id = v.project_id
		JOIN categories c ON c.id = p.category_id
		WHERE %s
		ORDER BY v.submitted_at DESC NULLS LAST, p.title
	`, strings.Join(conditions, " AND "))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.AdminJudgeVoteRow
	for rows.Next() {
		var item models.AdminJudgeVoteRow
		var submittedAt sql.NullTime
		if err := rows.Scan(
			&item.VoteID,
			&item.ProjectID,
			&item.ProjectName,
			&item.Category,
			&item.JudgeID,
			&item.JudgeName,
			&item.TotalScore,
			&submittedAt,
		); err != nil {
			return nil, err
		}
		if submittedAt.Valid {
			item.SubmittedAt = &submittedAt.Time
		}
		items = append(items, item)
	}

	return items, rows.Err()
}
