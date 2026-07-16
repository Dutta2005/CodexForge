'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, type BackendHealth, type BackendRepository } from '@/lib/api';
import { WorkspaceShell } from '@/components/workspace/shell';

export default function Repositories() {
  const [url, setUrl] = useState('https://github.com/Dutta2005/CodexForge');
  const [items, setItems] = useState<BackendRepository[]>([]);
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const [backendHealth, repositories] = await Promise.all([api.health(), api.listRepositories()]);
        if (!cancelled) {
          setHealth(backendHealth);
          setItems(repositories);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not reach backend');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function importRepository() {
    try {
      setImporting(true);
      setError(null);
      const repository = await api.importRepository(url);
      setItems((current) => [repository, ...current.filter((item) => item.id !== repository.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Repository import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <WorkspaceShell>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Repository Import</h1>
          <p className="mt-2 text-sm text-slate-400">Connected to backend: {api.baseUrl}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
          {health ? `${health.status} · ${health.database}` : loading ? 'Checking backend...' : 'Backend unavailable'}
        </div>
      </div>

      <Card className="mt-6">
        <label className="text-sm text-slate-400" htmlFor="repo-url">GitHub repository URL</label>
        <div className="mt-2 flex flex-col gap-3 md:flex-row">
          <input
            id="repo-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2 outline-none"
          />
          <Button disabled={importing || !url} onClick={importRepository}>
            {importing ? 'Importing...' : 'Clone & analyze'}
          </Button>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          This calls the FastAPI backend at <code>/api/repositories/import</code> and reloads persisted repositories.
        </p>
        {error && <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {loading && <Card>Loading repositories from backend...</Card>}
        {!loading && items.length === 0 && <Card>No repositories imported yet. Import one to verify the backend/database.</Card>}
        {items.map((repository) => (
          <Card key={repository.id}>
            <h2 className="font-semibold">{repository.name}</h2>
            <p className="text-sm text-slate-400">{repository.url}</p>
            <p className="mt-3">{repository.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(repository.dependencies ?? ['backend persisted']).map((dependency) => (
                <span className="rounded-full bg-white/10 px-2 py-1 text-xs" key={dependency}>{dependency}</span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </WorkspaceShell>
  );
}
