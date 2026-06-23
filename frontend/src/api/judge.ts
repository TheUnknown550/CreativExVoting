import { apiRequest, buildQuery } from './client';
import type {
  Category,
  JudgeAwardGroup,
  JudgeProjectCard,
  JudgeProjectDetail,
  JudgeSummaryRow,
  Vote,
  VoteSubmissionPayload,
} from '../types/domain';

export function getJudgeGroups(token: string) {
  return apiRequest<JudgeAwardGroup[] | null>('/judge/groups', { token }).then((data) => data ?? []);
}

export function getJudgeCategories(token: string, groupId?: string) {
  return apiRequest<Category[] | null>(
    `/judge/categories${buildQuery({ group_id: groupId })}`,
    { token },
  ).then((data) => data ?? []);
}

export function getJudgeProjects(token: string, categoryId?: string) {
  return apiRequest<JudgeProjectCard[] | null>(
    `/judge/projects${buildQuery({ category_id: categoryId })}`,
    { token },
  ).then((data) => data ?? []);
}

export function getJudgeProjectDetail(token: string, projectId: string) {
  return apiRequest<JudgeProjectDetail>(`/judge/projects/${projectId}`, { token }).then((data) => ({
    ...data,
    criteria: data.criteria ?? [],
  }));
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
  return apiRequest<JudgeSummaryRow[] | null>(
    `/judge/summary${buildQuery({ category_id: categoryId })}`,
    { token },
  ).then((data) => data ?? []);
}
