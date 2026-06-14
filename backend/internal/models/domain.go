package models

import "time"

const (
	RoleAdmin = "admin"
	RoleJudge = "judge"
)

type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	DisplayName  string    `json:"display_name"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Category struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Project struct {
	ID               string    `json:"id"`
	CategoryID       string    `json:"category_id"`
	CategoryName     string    `json:"category_name,omitempty"`
	Title            string    `json:"title"`
	ShortDescription string    `json:"short_description"`
	FullDescription  string    `json:"full_description"`
	Concept          string    `json:"concept"`
	DesignerName     string    `json:"designer_name"`
	TeamName         string    `json:"team_name"`
	ImageURL         string    `json:"image_url"`
	ProposalLink     string    `json:"proposal_link"`
	SocialMediaLink  string    `json:"social_media_link"`
	DriveLink        string    `json:"drive_link"`
	AttachedFileLink string    `json:"attached_file_link"`
	ExtraDetails     string    `json:"extra_details"`
	IsActive         bool      `json:"is_active"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type ScoringCriterion struct {
	ID           string    `json:"id"`
	CategoryID   string    `json:"category_id"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	MaxScore     int       `json:"max_score"`
	DisplayOrder int       `json:"display_order"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Vote struct {
	ID          string              `json:"id"`
	JudgeID     string              `json:"judge_id"`
	ProjectID   string              `json:"project_id"`
	TotalScore  int                 `json:"total_score"`
	SubmittedAt *time.Time          `json:"submitted_at"`
	CreatedAt   time.Time           `json:"created_at"`
	UpdatedAt   time.Time           `json:"updated_at"`
	Scores      []VoteCriterionScore `json:"scores,omitempty"`
}

type VoteCriterionScore struct {
	ID          string    `json:"id"`
	VoteID      string    `json:"vote_id"`
	CriterionID string    `json:"criterion_id"`
	Score       int       `json:"score"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type JudgeProjectCard struct {
	ID               string `json:"id"`
	CategoryID       string `json:"category_id"`
	Title            string `json:"title"`
	ShortDescription string `json:"short_description"`
	DesignerName     string `json:"designer_name"`
	TeamName         string `json:"team_name"`
	ImageURL         string `json:"image_url"`
	HasVoted         bool   `json:"has_voted"`
	CurrentScore     *int   `json:"current_score"`
	CategoryName     string `json:"category_name"`
}

type JudgeProjectDetail struct {
	Project  Project            `json:"project"`
	Criteria []ScoringCriterion `json:"criteria"`
}

type JudgeSummaryRow struct {
	Ranking    int    `json:"ranking"`
	ProjectID  string `json:"project_id"`
	ProjectName string `json:"project_name"`
	TotalScore int    `json:"total_score"`
	HasVoted   bool   `json:"has_voted"`
	CategoryID string `json:"category_id"`
}

type DashboardStats struct {
	TotalProjects        int     `json:"total_projects"`
	TotalJudges          int     `json:"total_judges"`
	TotalCategories      int     `json:"total_categories"`
	TotalVotesSubmitted  int     `json:"total_votes_submitted"`
	CompletionPercentage float64 `json:"completion_percentage"`
	PossibleVoteCount    int     `json:"possible_vote_count"`
}

type AdminProjectRanking struct {
	Ranking            int     `json:"ranking"`
	ProjectID          string  `json:"project_id"`
	ProjectName        string  `json:"project_name"`
	Category           string  `json:"category"`
	TotalScore         int     `json:"total_score"`
	AverageScore       float64 `json:"average_score"`
	SubmittedVotes     int     `json:"submitted_votes"`
	CompletionPercent  float64 `json:"completion_percent"`
}

type AdminJudgeVoteRow struct {
	VoteID       string     `json:"vote_id"`
	ProjectID    string     `json:"project_id"`
	ProjectName  string     `json:"project_name"`
	Category     string     `json:"category"`
	JudgeID      string     `json:"judge_id"`
	JudgeName    string     `json:"judge_name"`
	TotalScore   int        `json:"total_score"`
	SubmittedAt  *time.Time `json:"submitted_at"`
}

type ProjectVoteDetail struct {
	Project       Project               `json:"project"`
	CombinedScore int                   `json:"combined_score"`
	JudgeVotes    []ProjectJudgeVoteRow `json:"judge_votes"`
}

type ProjectJudgeVoteRow struct {
	VoteID      string                `json:"vote_id"`
	JudgeID     string                `json:"judge_id"`
	JudgeName   string                `json:"judge_name"`
	TotalScore  int                   `json:"total_score"`
	SubmittedAt *time.Time            `json:"submitted_at"`
	Scores      []ProjectCriterionRow `json:"scores"`
}

type ProjectCriterionRow struct {
	CriterionID   string `json:"criterion_id"`
	CriterionName string `json:"criterion_name"`
	MaxScore      int    `json:"max_score"`
	Score         int    `json:"score"`
}

type ResultsResponse struct {
	Rankings   []AdminProjectRanking `json:"rankings"`
	JudgeVotes []AdminJudgeVoteRow   `json:"judge_votes"`
}

type CSVExportRow struct {
	Category             string
	ProjectTitle         string
	JudgeName            string
	CriterionName        string
	CriterionScore       int
	ProjectTotalByJudge  int
	ProjectTotalOverall  int
	AverageScore         float64
}
