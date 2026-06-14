import { apiRequest, buildQuery, downloadAuthorizedFile } from './client';
import type {
  Category,
  CategoryPayload,
  CriterionPayload,
  DashboardStats,
  JudgePayload,
  Project,
  ProjectPayload,
  ProjectVoteDetail,
  ResultsResponse,
  ScoringCriterion,
  User,
} from '../types/domain';

export function getDashboard(token: string) {
  return apiRequest<DashboardStats>('/admin/dashboard', { token });
}

export function getAdminCategories(token: string) {
  return apiRequest<Category[]>('/admin/categories', { token });
}

export function createCategory(token: string, payload: CategoryPayload) {
  return apiRequest<Category>('/admin/categories', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function updateCategory(token: string, id: string, payload: CategoryPayload) {
  return apiRequest<Category>(`/admin/categories/${id}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload),
  });
}

export function deleteCategory(token: string, id: string) {
  return apiRequest<{ message: string }>(`/admin/categories/${id}`, {
    method: 'DELETE',
    token,
  });
}

export function getAdminProjects(token: string, categoryId?: string, search?: string) {
  return apiRequest<Project[]>(
    `/admin/projects${buildQuery({ category_id: categoryId, search })}`,
    { token },
  );
}

export function createProject(token: string, payload: ProjectPayload) {
  return apiRequest<Project>('/admin/projects', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function updateProject(token: string, id: string, payload: ProjectPayload) {
  return apiRequest<Project>(`/admin/projects/${id}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload),
  });
}

export function deleteProject(token: string, id: string) {
  return apiRequest<{ message: string }>(`/admin/projects/${id}`, {
    method: 'DELETE',
    token,
  });
}

export function getAdminCriteria(token: string, categoryId?: string) {
  return apiRequest<ScoringCriterion[]>(
    `/admin/criteria${buildQuery({ category_id: categoryId })}`,
    { token },
  );
}

export function createCriterion(token: string, payload: CriterionPayload) {
  return apiRequest<ScoringCriterion>('/admin/criteria', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function updateCriterion(token: string, id: string, payload: CriterionPayload) {
  return apiRequest<ScoringCriterion>(`/admin/criteria/${id}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload),
  });
}

export function deleteCriterion(token: string, id: string) {
  return apiRequest<{ message: string }>(`/admin/criteria/${id}`, {
    method: 'DELETE',
    token,
  });
}

export function getAdminJudges(token: string) {
  return apiRequest<User[]>('/admin/judges', { token });
}

export function createJudge(token: string, payload: JudgePayload) {
  return apiRequest<User>('/admin/judges', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function updateJudge(token: string, id: string, payload: JudgePayload) {
  return apiRequest<User>(`/admin/judges/${id}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload),
  });
}

export function deleteJudge(token: string, id: string) {
  return apiRequest<{ message: string }>(`/admin/judges/${id}`, {
    method: 'DELETE',
    token,
  });
}

export function resetJudgePassword(token: string, id: string, password: string) {
  return apiRequest<{ message: string }>(`/admin/judges/${id}/reset-password`, {
    method: 'POST',
    token,
    body: JSON.stringify({ password }),
  });
}

export function getJudgeAssignments(token: string, id: string) {
  return apiRequest<string[]>(`/admin/judges/${id}/categories`, { token });
}

export function replaceJudgeAssignments(token: string, id: string, categoryIds: string[]) {
  return apiRequest<{ message: string }>(`/admin/judges/${id}/categories`, {
    method: 'POST',
    token,
    body: JSON.stringify({ category_ids: categoryIds }),
  });
}

export function deleteJudgeAssignment(token: string, id: string, categoryId: string) {
  return apiRequest<{ message: string }>(`/admin/judges/${id}/categories/${categoryId}`, {
    method: 'DELETE',
    token,
  });
}

export function getAdminResults(token: string, categoryId?: string, judgeId?: string) {
  return apiRequest<ResultsResponse>(
    `/admin/results${buildQuery({ category_id: categoryId, judge_id: judgeId })}`,
    { token },
  );
}

export function getProjectVoteDetail(token: string, projectId: string) {
  return apiRequest<ProjectVoteDetail>(`/admin/projects/${projectId}/vote-details`, { token });
}

export async function exportResultsCsv(token: string, categoryId?: string, judgeId?: string) {
  return downloadAuthorizedFile(
    `/admin/results/export.csv${buildQuery({ category_id: categoryId, judge_id: judgeId })}`,
    token,
  );
}
