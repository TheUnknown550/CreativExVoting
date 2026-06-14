package models

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type CategoryPayload struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	IsActive    bool   `json:"is_active"`
}

type ProjectPayload struct {
	CategoryID       string `json:"category_id"`
	Title            string `json:"title"`
	ShortDescription string `json:"short_description"`
	FullDescription  string `json:"full_description"`
	Concept          string `json:"concept"`
	DesignerName     string `json:"designer_name"`
	TeamName         string `json:"team_name"`
	ImageURL         string `json:"image_url"`
	ProposalLink     string `json:"proposal_link"`
	SocialMediaLink  string `json:"social_media_link"`
	DriveLink        string `json:"drive_link"`
	AttachedFileLink string `json:"attached_file_link"`
	ExtraDetails     string `json:"extra_details"`
	IsActive         bool   `json:"is_active"`
}

type CriterionPayload struct {
	CategoryID   string `json:"category_id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	MaxScore     int    `json:"max_score"`
	DisplayOrder int    `json:"display_order"`
	IsActive     bool   `json:"is_active"`
}

type JudgePayload struct {
	Username    string   `json:"username"`
	DisplayName string   `json:"display_name"`
	Password    string   `json:"password,omitempty"`
	Role        string   `json:"role"`
	IsActive    bool     `json:"is_active"`
	CategoryIDs []string `json:"category_ids,omitempty"`
}

type ResetPasswordPayload struct {
	Password string `json:"password"`
}

type AssignmentPayload struct {
	CategoryIDs []string `json:"category_ids"`
}

type VoteCriterionInput struct {
	CriterionID string `json:"criterion_id"`
	Score       int    `json:"score"`
}

type VoteSubmissionRequest struct {
	Scores []VoteCriterionInput `json:"scores"`
}
