'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type BackendHealth, type BackendRepository } from '@/lib/api';
import { WorkspaceShell } from '@/components/workspace/shell';
import { Github, Database, Code2, CheckCircle2, Box, Info } from 'lucide-react';

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
    return () => { cancelled = true; };
  }, []);

  async function importRepository() {
    try {
      setImporting(true);
      setError(null);
      const repository = await api.importRepository(url);
      setItems((current) => [repository, ...current.filter((item) => item.id !== repository.id)]);
      setUrl('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Repository import failed';
      setError(msg);

      if (msg.includes('404') || msg.includes('403') || msg.toLowerCase().includes('authentication') || msg.includes('not found') || msg.includes('Could not read from remote repository')) {
        const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME ?? 'codexforge-raj';
        const installUrl = appName
          ? `https://github.com/apps/${appName}/installations/new`
          : "https://github.com/settings/installations";

        window.open(installUrl, "_blank");
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <WorkspaceShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Repositories</h1>
          <p className="mt-1 text-sm text-slate-400">Import and analyze codebases for AI tasks.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-forge-border bg-forge-surface px-4 py-2 text-sm text-slate-300">
          <Database className="h-4 w-4 text-forge-accent" />
          {health ? `${health.status} · ${health.database}` : loading ? 'Checking backend...' : 'Backend unavailable'}
        </div>
      </div>

      <Card className="mb-8">
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-forge-teal/20 bg-forge-teal/10 p-4 text-sm text-forge-teal">
          <Info className="h-5 w-5 shrink-0" />
          <p>
            <strong className="font-semibold">GitHub App Users:</strong> Make sure you have explicitly installed your GitHub App on the target repository in your <a href="https://github.com/settings/installations" target="_blank" rel="noreferrer" className="underline hover:text-white">GitHub Installation Settings</a>. If the app is not installed on the repository, AI tasks will fail to create branches or pull requests.
          </p>
        </div>

        <label className="text-sm font-medium text-slate-300 mb-2 block" htmlFor="repo-url">
          Import from GitHub
        </label>
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              id="repo-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className="pl-10"
              placeholder="https://github.com/owner/repo"
            />
          </div>
          <Button disabled={importing || !url} onClick={importRepository} loading={importing}>
            {importing ? 'Cloning & Analyzing...' : 'Import Repository'}
          </Button>
        </div>
        {error && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="flex flex-col h-[280px]">
              <Skeleton className="h-6 w-3/4 mb-4" />
              <Skeleton className="h-4 w-1/2 mb-6" />
              <Skeleton className="h-20 w-full mb-4" />
              <div className="mt-auto flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </Card>
          ))
        ) : items.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-forge-border py-20 text-center">
            <div className="mb-4 rounded-full bg-white/5 p-4">
              <Box className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-200">No repositories yet</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-sm">
              Import a repository above to start analyzing architecture and running AI tasks.
            </p>
          </div>
        ) : (
          items.map((repository) => (
            <Card key={repository.id} className="flex flex-col h-full hover:border-forge-accent/50 group animate-fade-in">
              <div className="flex items-start justify-between mb-4">
                <div className="flex flex-col overflow-hidden">
                  <h2 className="font-bold text-lg truncate" title={repository.name}>{repository.name}</h2>
                  <a href={repository.url} target="_blank" rel="noreferrer" className="text-xs text-forge-accent hover:underline truncate mt-1 block">
                    {repository.url.replace('https://github.com/', '')}
                  </a>
                </div>
                <div className="h-8 w-8 rounded bg-forge-accent/10 flex items-center justify-center flex-shrink-0">
                  <Code2 className="h-4 w-4 text-forge-accent" />
                </div>
              </div>

              <div className="mb-6 flex-1">
                <p className="text-sm text-slate-400 line-clamp-3 leading-relaxed">
                  {repository.summary}
                </p>
              </div>

              <div className="mt-auto">
                <div className="mb-4">
                  <Badge variant="outline" className="bg-white/5">{repository.framework}</Badge>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(repository.languages || []).slice(0, 4).map((lang) => (
                    <span className="rounded-md bg-black/40 px-2 py-1 text-[10px] font-medium text-slate-300" key={lang}>
                      {lang}
                    </span>
                  ))}
                  {repository.languages?.length > 4 && (
                    <span className="rounded-md bg-black/40 px-2 py-1 text-[10px] font-medium text-slate-500">
                      +{repository.languages.length - 4}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-forge-border pt-4 text-xs text-slate-500">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Imported {new Date(repository.importedAt * 1000).toLocaleDateString()}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </WorkspaceShell>
  );
}
