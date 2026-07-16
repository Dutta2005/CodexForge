import { describe, expect, it } from 'vitest';
import { graphEdges, graphNodes, repositories, taskRuns } from '@/lib/mock-data';
describe('CodexForge fixtures', () => {
  it('models repositories with analysis metadata', () => {
    expect(repositories[0].framework).toContain('Next.js');
    expect(repositories[0].dependencies).toContain('fastapi');
  });
  it('keeps graph edges connected to existing nodes', () => {
    const ids = new Set(graphNodes.map((node) => node.id));
    expect(graphEdges.every((edge) => ids.has(edge.source) && ids.has(edge.target))).toBe(true);
  });
  it('captures the autonomous task pipeline', () => {
    expect(taskRuns[0].plan).toHaveLength(5);
    expect(taskRuns[0].tests.failed).toBe(0);
  });
});
