'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { api, type ArchitectureEdge, type ArchitectureNode, type BackendRepository } from '@/lib/api';
import { WorkspaceShell } from '@/components/workspace/shell';

export default function Architecture() {
  const [repositories, setRepositories] = useState<BackendRepository[]>([]);
  const [repoId, setRepoId] = useState('');
  const [nodes, setNodes] = useState<ArchitectureNode[]>([]);
  const [edges, setEdges] = useState<ArchitectureEdge[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.listRepositories().then((repos) => { setRepositories(repos); setRepoId(repos[0]?.id ?? ''); }).catch((err) => setError(err.message)); }, []);
  useEffect(() => { if (repoId) api.architecture(repoId).then((graph) => { setNodes(graph.nodes); setEdges(graph.edges); }).catch((err) => setError(err.message)); }, [repoId]);

  return (
    <WorkspaceShell>
      <h1 className="text-3xl font-semibold">Architecture View</h1>
      <select className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3" value={repoId} onChange={(event) => setRepoId(event.target.value)}>
        {repositories.map((repo) => <option key={repo.id} value={repo.id}>{repo.name}</option>)}
      </select>
      {error && <Card className="mt-4 border-rose-400/30 text-rose-200">{error}</Card>}
      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card><div className="relative h-[520px] overflow-hidden rounded-xl bg-black/30">{nodes.map((node, index) => <div key={node.id} className="absolute rounded-2xl border border-cyan-300/30 bg-white/10 px-4 py-3" style={{ left: 60 + (index % 3) * 220, top: 50 + Math.floor(index / 3) * 90 }}>{node.label}<p className="text-xs text-slate-400">{node.type}</p></div>)}</div></Card>
        <Card><h2 className="font-semibold">Relationships</h2>{edges.map((edge) => <p className="mt-3 rounded-xl bg-black/20 p-3" key={edge.id}>{edge.source} → {edge.target}</p>)}</Card>
      </div>
    </WorkspaceShell>
  );
}
