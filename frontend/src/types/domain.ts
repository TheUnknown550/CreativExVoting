export type Role = 'admin' | 'judge';

export interface User {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  category_id: string;
  category_name?: string;
  title: string;
  short_description: string;
  full_description: string;
  concept: string;
  designer_name: string;
  team_name: string;
  image_url: string;
  proposal_link: string;
  social_media_link: string;
  drive_link: string;
  attached_file_link: string;
  extra_details: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScoringCriterion {
  id: string;
  category_id: string;
  name: string;
  description: string;
  max_score: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VoteScore {
  id: string;
  vote_id: string;
  criterion_id: string;
  score: number;
  created_at: string;
  updated_at: string;
}

export interface Vote {
  id: string;
  judge_id: string;
  project_id: string;
  total_score: number;
  submitted_at?: string | null;
  created_at: string;
  updated_at: string;
  scores: VoteScore[];
}

export interface JudgeProjectCard {
  id: string;
  category_id: string;
  title: string;
  short_description: string;
  designer_name: string;
  team_name: string;
  image_url: string;
  has_voted: boolean;
  current_score?: number | null;
  category_name: string;
}

export interface JudgeProjectDetail {
  project: Project;
  criteria: ScoringCriterion[];
}

export interface JudgeSummaryRow {
  ranking: number;
  project_id: string;
  project_name: string;
  total_score: number;
  has_voted: boolean;
  category_id: string;
}

export interface DashboardStats {
  total_projects: number;
  total_judges: number;
  total_categories: number;
  total_votes_submitted: number;
  completion_percentage: number;
  possible_vote_count: number;
}

export interface AdminProjectRanking {
  ranking: number;
  project_id: string;
  project_name: string;
  category: string;
  total_score: number;
  average_score: number;
  submitted_votes: number;
  completion_percent: number;
}

export interface AdminJudgeVoteRow {
  vote_id: string;
  project_id: string;
  project_name: string;
  category: string;
  judge_id: string;
  judge_name: string;
  total_score: number;
  submitted_at?: string | null;
}

export interface ResultsResponse {
  rankings: AdminProjectRanking[];
  judge_votes: AdminJudgeVoteRow[];
}

export interface ProjectCriterionRow {
  criterion_id: string;
  criterion_name: string;
  max_score: number;
  score: number;
}

export interface ProjectJudgeVoteRow {
  vote_id: string;
  judge_id: string;
  judge_name: string;
  total_score: number;
  submitted_at?: string | null;
  scores: ProjectCriterionRow[];
}

export interface ProjectVoteDetail {
  project: Project;
  combined_score: number;
  judge_votes: ProjectJudgeVoteRow[];
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface CategoryPayload {
  name: string;
  description: string;
  is_active: boolean;
}

export interface ProjectPayload {
  category_id: string;
  title: string;
  short_description: string;
  full_description: string;
  concept: string;
  designer_name: string;
  team_name: string;
  image_url: string;
  proposal_link: string;
  social_media_link: string;
  drive_link: string;
  attached_file_link: string;
  extra_details: string;
  is_active: boolean;
}

export interface CriterionPayload {
  category_id: string;
  name: string;
  description: string;
  max_score: number;
  display_order: number;
  is_active: boolean;
}

export interface JudgePayload {
  username: string;
  display_name: string;
  password?: string;
  role: Role;
  is_active: boolean;
  category_ids: string[];
}

export interface VoteSubmissionPayload {
  scores: Array<{
    criterion_id: string;
    score: number;
  }>;
}
