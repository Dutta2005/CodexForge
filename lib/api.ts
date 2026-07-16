import { repositories, taskRuns, graphEdges, graphNodes } from '@/lib/mock-data';
export const api = {
  async importRepository(url: string) { return { ...repositories[0], id: crypto.randomUUID(), url, importedAt: new Date().toISOString() }; },
  async listRepositories() { return repositories; },
  async listTasks() { return taskRuns; },
  async architecture() { return { nodes: graphNodes, edges: graphEdges }; },
  async createTask(title: string) { return { ...taskRuns[0], id: crypto.randomUUID(), title, status: 'planned' as const, createdAt: new Date().toISOString() }; },
};
