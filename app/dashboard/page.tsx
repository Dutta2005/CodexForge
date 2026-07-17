'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api, type BackendDashboard } from '@/lib/api';
import { WorkspaceShell } from '@/components/workspace/shell';
import { GitBranch, Cpu, Clock, LayoutGrid } from 'lucide-react';

export default function Dashboard() {
  const [dashboard, setDashboard] = useState<BackendDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboard()
      .then(setDashboard)
      .catch((err) => setError(err instanceof Error ? err.message : 'Dashboard failed'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <WorkspaceShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-slate-400 mt-1">Metrics and recent activity across your workspace.</p>
      </div>

      {error && (
        <div className="mb-8 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in">
        <Card className="flex flex-col">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <LayoutGrid className="h-4 w-4" />
            <h3 className="text-sm font-medium">Repositories</h3>
          </div>
          {loading ? <Skeleton className="h-10 w-16 mt-1" /> : <p className="text-4xl font-bold">{dashboard?.stats.repositories ?? 0}</p>}
        </Card>
        
        <Card className="flex flex-col">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Cpu className="h-4 w-4" />
            <h3 className="text-sm font-medium">Tasks Run</h3>
          </div>
          {loading ? <Skeleton className="h-10 w-16 mt-1" /> : <p className="text-4xl font-bold">{dashboard?.stats.tasks ?? 0}</p>}
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col h-full animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-forge-accent" />
              <h2 className="font-bold text-lg">Recent Repositories</h2>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 flex-1">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))
            ) : dashboard?.repositories.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 py-8 text-center">
                <p className="text-slate-400 text-sm">No repositories imported yet.</p>
              </div>
            ) : (
              dashboard?.repositories.map((repo) => (
                <div key={repo.id} className="flex items-center justify-between rounded-xl bg-black/20 border border-white/5 p-4 transition-colors hover:bg-white/5">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{repo.name}</span>
                    <span className="text-xs text-slate-500 truncate max-w-[200px] sm:max-w-xs">{repo.url}</span>
                  </div>
                  <Badge variant="outline">{repo.framework}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="flex flex-col h-full animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-forge-accent" />
              <h2 className="font-bold text-lg">Recent Tasks</h2>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 flex-1">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))
            ) : dashboard?.tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 py-8 text-center">
                <p className="text-slate-400 text-sm">No tasks run yet.</p>
              </div>
            ) : (
              dashboard?.tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded-xl bg-black/20 border border-white/5 p-4 transition-colors hover:bg-white/5">
                  <div className="flex flex-col max-w-[60%]">
                    <span className="font-medium text-sm truncate">{task.title}</span>
                    <span className="text-xs text-slate-500">ID: {task.id}</span>
                  </div>
                  <Badge variant={
                    task.status === 'finished' ? 'success' : 
                    task.status === 'failed' ? 'destructive' : 
                    task.status === 'running' ? 'warning' : 'default'
                  }>
                    {task.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
