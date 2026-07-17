export type BackendHealth = {
  status: string;
  database: 'postgres' | 'sqlite' | string;
  workspaceRoot: string;
  codexConfigured: boolean;
};

export type BackendRepository = {
  id: string;
  name: string;
  url: string;
  framework: string;
  summary: string;
  languages: string[];
  dependencies: string[];
  localPath: string;
  importedAt: number;
};

export type BackendTask = {
  id: string;
  repoId: string;
  title: string;
  status: string;
  plan: string[];
  logs: string[];
  filesChanged: string[];
  testOutput?: string;
  prUrl?: string;
  createdAt: number;
};

export type BackendDashboard = {
  stats: { repositories: number; tasks: number };
  repositories: BackendRepository[];
  tasks: BackendTask[];
};

export type ArchitectureNode = { id: string; label: string; type: string };
export type ArchitectureEdge = { id: string; source: string; target: string };

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
  health: () => request<BackendHealth>('/api/health'),
  dashboard: () => request<BackendDashboard>('/api/dashboard'),
  listRepositories: () => request<BackendRepository[]>('/api/repositories'),
  importRepository: (url: string) => request<BackendRepository>('/api/repositories/import', { method: 'POST', body: JSON.stringify({ url }) }),
  listTasks: () => request<BackendTask[]>('/api/tasks'),
  createTask: (repoId: string, prompt: string) => request<BackendTask>('/api/tasks', { method: 'POST', body: JSON.stringify({ repo_id: repoId, prompt }) }),
  architecture: (repoId: string) => request<{ nodes: ArchitectureNode[]; edges: ArchitectureEdge[] }>(`/api/architecture/${repoId}`),
};
