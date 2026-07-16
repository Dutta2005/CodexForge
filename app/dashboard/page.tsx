'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { api, type BackendDashboard } from '@/lib/api';
import { WorkspaceShell } from '@/components/workspace/shell';

export default function Dashboard() {
  const [dashboard, setDashboard] = useState<BackendDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.dashboard().then(setDashboard).catch((err) => setError(err instanceof Error ? err.message : 'Dashboard failed'));
  }, []);

  return (
    <WorkspaceShell>
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      {error && <Card className="mt-6 border-rose-400/30 text-rose-200">{error}</Card>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card><p className="text-sm text-slate-400">Repositories</p><p className="mt-2 text-3xl font-bold">{dashboard?.stats.repositories ?? '—'}</p></Card>
        <Card><p className="text-sm text-slate-400">Tasks</p><p className="mt-2 text-3xl font-bold">{dashboard?.stats.tasks ?? '—'}</p></Card>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card><h2 className="font-semibold">Recent repositories</h2>{dashboard?.repositories.map((repo) => <p className="mt-3 rounded-xl bg-black/20 p-3" key={repo.id}>{repo.name} · {repo.framework}</p>)}</Card>
        <Card><h2 className="font-semibold">Recent tasks</h2>{dashboard?.tasks.map((task) => <p className="mt-3 rounded-xl bg-black/20 p-3" key={task.id}>{task.title} · {task.status}</p>)}</Card>
      </div>
    </WorkspaceShell>
  );
}
