"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  api,
  type ArchitectureEdge,
  type ArchitectureNode,
  type BackendRepository,
} from "@/lib/api";
import { WorkspaceShell } from "@/components/workspace/shell";

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
        setLoadingRepositories(true);
        const repos = await api.listRepositories();
        if (!cancelled) {
          setRepositories(repos);
          setRepoId(repos[0]?.id ?? "");
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Could not load repositories",
          );
      } finally {
        if (!cancelled) setLoadingRepositories(false);
      }
    }

    loadRepositories();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!repoId) {
      setNodes([]);
      setEdges([]);
      return;
    }

    let cancelled = false;

    async function loadGraph() {
      try {
        setError(null);
        setLoadingGraph(true);
        const graph = await api.architecture(repoId);
        if (!cancelled) {
          setNodes(graph.nodes);
          setEdges(graph.edges);
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : "Could not load architecture graph",
          );
      } finally {
        if (!cancelled) setLoadingGraph(false);
      }
    }

    loadGraph();
    return () => {
      cancelled = true;
    };
  }, [repoId]);

  return (
    <WorkspaceShell>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Architecture View</h1>
          <p className="mt-2 text-sm text-slate-400">
            Inspect the imported repository structure and the backend-generated
            node map.
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
          {loadingRepositories
            ? "Loading repositories..."
            : repositories.length
              ? `${repositories.length} ${repositories.length === 1 ? "repository" : "repositories"}`
              : "No repositories imported"}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
        <select
          className="rounded-xl border border-white/10 bg-black/30 p-3 md:min-w-80"
          value={repoId}
          onChange={(event) => setRepoId(event.target.value)}
          disabled={loadingRepositories || repositories.length === 0}
        >
          {repositories.length === 0 && (
            <option value="">Import a repository first</option>
          )}
          {repositories.map((repo) => (
            <option key={repo.id} value={repo.id}>
              {repo.name}
            </option>
          ))}
        </select>
        <p className="text-sm text-slate-400">
          {loadingGraph
            ? "Loading graph..."
            : "Select a repository to render its folder graph."}
        </p>
      </div>
      {error && (
        <Card className="mt-4 border-rose-400/30 text-rose-200">{error}</Card>
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <div className="relative h-[520px] overflow-hidden rounded-xl bg-black/30">
            {loadingGraph && (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Building architecture showcase...
              </div>
            )}
            {!loadingGraph && repoId && nodes.length === 0 && !error && (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                This repository does not have enough files yet to render the
                architecture graph.
              </div>
            )}
            {!loadingGraph &&
              nodes.map((node, index) => (
                <div
                  key={node.id}
                  className="absolute rounded-2xl border border-cyan-300/30 bg-white/10 px-4 py-3"
                  style={{
                    left: 60 + (index % 3) * 220,
                    top: 50 + Math.floor(index / 3) * 90,
                  }}
                >
                  {node.label}
                  <p className="text-xs text-slate-400">{node.type}</p>
                </div>
              ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold">Relationships</h2>
          {loadingGraph && (
            <p className="mt-3 rounded-xl bg-black/20 p-3 text-sm text-slate-400">
              Loading links...
            </p>
          )}
          {!loadingGraph && edges.length === 0 && !error && (
            <p className="mt-3 rounded-xl bg-black/20 p-3 text-sm text-slate-400">
              No relationships to display yet.
            </p>
          )}
          {!loadingGraph &&
            edges.map((edge) => (
              <p className="mt-3 rounded-xl bg-black/20 p-3" key={edge.id}>
                {edge.source} → {edge.target}
              </p>
            ))}
        </Card>
      </div>
    </WorkspaceShell>
  );
}
