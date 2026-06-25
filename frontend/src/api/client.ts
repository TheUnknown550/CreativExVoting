import type { ApiEnvelope } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';

let unauthorizedHandler: (() => void) | null = null;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

interface RequestOptions extends RequestInit {
  token?: string | null;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    unauthorizedHandler?.();
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? (await response.json()) as ApiEnvelope<T> : null;

  if (!response.ok) {
    throw new ApiError(payload?.error ?? response.statusText, response.status);
  }

  if (!payload?.success) {
    throw new ApiError(payload?.error ?? 'คำขอไม่สำเร็จ', response.status);
  }

  return payload.data as T;
}

export async function uploadAuthorizedFile<T>(
  path: string,
  file: File,
  token: string | null,
  field = 'file',
): Promise<T> {
  const form = new FormData();
  form.append(field, file);

  const headers = new Headers();
  headers.set('Accept', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: form,
  });

  if (response.status === 401) {
    unauthorizedHandler?.();
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? ((await response.json()) as ApiEnvelope<T>) : null;

  if (!response.ok || !payload?.success) {
    throw new ApiError(payload?.error ?? response.statusText, response.status);
  }

  return payload.data as T;
}

export async function downloadAuthorizedFile(path: string, token: string | null) {
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (response.status === 401) {
    unauthorizedHandler?.();
  }
  if (!response.ok) {
    throw new ApiError(response.statusText, response.status);
  }

  return response.blob();
}

export function buildQuery(params: Record<string, string | number | undefined | null>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}
