import { apiRequest, buildQuery } from './client';
import type {
  Category,
  JudgeProjectCard,
  JudgeProjectDetail,
  JudgeSummaryRow,
  Vote,
  VoteSubmissionPayload,
} from '../types/domain';

export function getJudgeCategories(token: string) {
  return apiRequest<Category[]>('/judge/categories', { token });
}

export function getJudgeProjects(token: string, categoryId?: string) {
  return apiRequest<JudgeProjectCard[]>(
    `/judge/projects${buildQuery({ category_id: categoryId })}`,
    { token },
  );
}

export function getJudgeProjectDetail(token: string, projectId: string) {
  return apiRequest<JudgeProjectDetail>(`/judge/projects/${projectId}`, { token });
}

export function getMyVote(token: string, projectId: string) {
  return apiRequest<Vote | null>(`/judge/projects/${projectId}/my-vote`, { token });
}

export function submitVote(token: string, projectId: string, payload: VoteSubmissionPayload) {
  return apiRequest<Vote>(`/judge/projects/${projectId}/vote`, {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function updateVote(token: string, projectId: string, payload: VoteSubmissionPayload) {
  return apiRequest<Vote>(`/judge/projects/${projectId}/vote`, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload),
  });
}

export function getJudgeSummary(token: string, categoryId?: string) {
  return apiRequest<JudgeSummaryRow[]>(
    `/judge/summary${buildQuery({ category_id: categoryId })}`,
    { token },
  );
}
