import { apiRequest } from './client';
import type { LoginResponse, User } from '../types/domain';

export function login(username: string, password: string) {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function me(token: string) {
  return apiRequest<User>('/auth/me', { token });
}
