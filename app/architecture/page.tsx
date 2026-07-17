"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type ArchitectureEdge, type ArchitectureNode, type BackendRepository } from "@/lib/api";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Network, FolderTree, FileCode, Search } from "lucide-react";

export default function Architecture() {
  const [repositories, setRepositories] = useState<BackendRepository[]>([]);
  const [repoId, setRepoId] = useState("");
  const [nodes, setNodes] = useState<ArchitectureNode[]>([]);
  const [edges, setEdges] = useState<ArchitectureEdge[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingRepositories, setLoadingRepositories] = useState(true);
  const [loadingGraph, setLoadingGraph] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadRepositories() {
      try {
        setError(null);
        const repos = await api.listRepositories();
        if (!cancelled) {
          setRepositories(repos);
          setRepoId(repos[0]?.id ?? "");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load repositories");
      } finally {
        if (!cancelled) setLoadingRepositories(false);
      }
    }
    loadRepositories();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!repoId) { setNodes([]); setEdges([]); return; }
    let cancelled = false;
    async function loadGraph() {
      try {
        setError(null);
        setLoadingGraph(true);
        const graph = await api.architecture(repoId);
        if (!cancelled) { setNodes(graph.nodes); setEdges(graph.edges); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load architecture graph");
      } finally {
        if (!cancelled) setLoadingGraph(false);
      }
    }
    loadGraph();
    return () => { cancelled = true; };
  }, [repoId]);

  return (
    <WorkspaceShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Architecture</h1>
          <p className="mt-1 text-sm text-slate-400">Visualize dependency graphs and project structure.</p>
        </div>
      </div>

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <select
              className="flex h-10 w-full appearance-none rounded-xl border border-forge-border bg-black/30 pl-10 pr-4 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-forge-accent disabled:opacity-50"
              value={repoId}
              onChange={(event) => setRepoId(event.target.value)}
              disabled={loadingRepositories || repositories.length === 0}
            >
              {repositories.length === 0 && <option value="">Import a repository first</option>}
              {repositories.map((repo) => (
                <option key={repo.id} value={repo.id}>{repo.name}</option>
              ))}
            </select>
          </div>
          <p className="text-sm text-slate-500">
            {loadingGraph ? "Mapping architecture..." : `${nodes.length} nodes, ${edges.length} connections`}
          </p>
        </div>
      </Card>

      {error && <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 flex flex-col p-0 overflow-hidden h-[600px] bg-[url('/grid.svg')] bg-center relative">
          <div className="absolute inset-0 bg-forge-bg/90" />
          
          <div className="relative z-10 flex-1 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Network className="h-5 w-5 text-forge-accent" />
              <h2 className="font-bold">Topology Map</h2>
            </div>
            
            <div className="relative h-[480px] w-full">
              {loadingGraph && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-forge-border border-t-forge-accent"></div>
                    <p className="text-sm text-slate-400">Rendering graph layout...</p>
                  </div>
                </div>
              )}
              
              {!loadingGraph && nodes.length === 0 && !error && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-sm text-slate-500">No architecture data available for this repository.</p>
                </div>
              )}
              
              {!loadingGraph && nodes.map((node, index) => (
                <div
                  key={node.id}
                  className="absolute animate-fade-in group"
                  style={{ left: 50 + (index % 5) * 120, top: 20 + Math.floor(index / 5) * 100, animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl border shadow-lg backdrop-blur-sm transition-transform group-hover:scale-110 ${node.type === 'folder' ? 'border-forge-teal/30 bg-forge-teal/10' : 'border-forge-accent/30 bg-forge-accent/10'}`}>
                      {node.type === 'folder' ? <FolderTree className="h-5 w-5 text-forge-teal" /> : <FileCode className="h-5 w-5 text-forge-accent" />}
                    </div>
                    <span className="max-w-[120px] truncate text-xs font-medium text-slate-300 rounded bg-black/50 px-2 py-1">{node.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
        
        <Card className="flex flex-col h-[600px] overflow-hidden">
          <h2 className="font-bold mb-4">Relationships</h2>
          <div className="flex-1 overflow-y-auto pr-2 space-y-2">
            {loadingGraph && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            
            {!loadingGraph && edges.length === 0 && !error && (
              <p className="text-sm text-slate-500 text-center py-10">No connections mapped.</p>
            )}
            
            {!loadingGraph && edges.map((edge) => (
              <div key={edge.id} className="flex items-center justify-between rounded-lg bg-black/20 p-3 border border-white/5">
                <span className="text-sm font-medium text-slate-300">{edge.source}</span>
                <span className="text-xs text-forge-muted mx-2">→</span>
                <span className="text-sm font-medium text-slate-300">{edge.target}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
