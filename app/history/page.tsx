'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { api, type BackendTask } from '@/lib/api';
import { WorkspaceShell } from '@/components/workspace/shell';

export default function History() {
  const [tasks, setTasks] = useState<BackendTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.listTasks().then(setTasks).catch((err) => setError(err.message)); }, []);
  return <WorkspaceShell><h1 className="text-3xl font-semibold">History</h1>{error && <Card className="mt-4 border-rose-400/30 text-rose-200">{error}</Card>}<div className="mt-6 space-y-4">{tasks.map((task) => <Card key={task.id}><h2 className="font-semibold">{task.title}</h2><p className="text-sm text-slate-400">{task.status} · {new Date(task.createdAt * 1000).toLocaleString()}</p><pre className="mt-3 whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-xs">{task.logs.join('\n')}</pre></Card>)}</div></WorkspaceShell>;
}
