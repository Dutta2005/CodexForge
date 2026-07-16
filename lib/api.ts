import type { Repository } from '@/types/domain';

export type BackendHealth = {
  status: string;
  database: 'postgres' | 'sqlite' | string;
};

export type BackendTask = {
  id: string;
  status: string;
  commitMessage: string;
};

export type BackendRepository = Partial<Repository> & {
  id: string;
  name: string;
  url: string;
  framework: string;
  summary: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  baseUrl: API_BASE_URL,
  health() {
    return request<BackendHealth>('/api/health');
  },
  listRepositories() {
    return request<BackendRepository[]>('/api/repositories');
  },
  importRepository(url: string) {
    return request<BackendRepository>('/api/repositories/import', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  },
  createTask(repoId: string, prompt: string) {
    return request<BackendTask>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ repo_id: repoId, prompt }),
    });
  },
};
