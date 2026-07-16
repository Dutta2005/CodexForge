'use client';

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, type BackendRepository, type BackendTask } from '@/lib/api';
import { taskRuns } from '@/lib/mock-data';
import { WorkspaceShell } from '@/components/workspace/shell';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export default function Tasks() {
  const [prompt, setPrompt] = useState('Fix Issue #12');
  const [repositories, setRepositories] = useState<BackendRepository[]>([]);
  const [repoId, setRepoId] = useState('');
  const [task, setTask] = useState<BackendTask | null>(null);
  const [logs, setLogs] = useState<string[]>(['Waiting for backend task...']);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRepositories() {
      try {
        const nextRepositories = await api.listRepositories();
        if (!cancelled) {
          setRepositories(nextRepositories);
          setRepoId((current) => current || nextRepositories[0]?.id || 'repo_1');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load repositories');
      }
    }

    loadRepositories();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const socket: Socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => setLogs((current) => [...current, `Socket connected: ${socket.id}`]));
    socket.on('connect_error', (err) => setLogs((current) => [...current, `Socket error: ${err.message}`]));
    socket.on('task:log', (event: { task_id: string; message: string }) => {
      setLogs((current) => [...current, `[${event.task_id}] ${event.message}`]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  async function runTask() {
    try {
      setRunning(true);
      setError(null);
      setLogs(['Submitting task to backend...']);
      const createdTask = await api.createTask(repoId || repositories[0]?.id || 'repo_1', prompt);
      setTask(createdTask);
      setLogs((current) => [...current, `Backend returned ${createdTask.status}: ${createdTask.commitMessage}`]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Task failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <WorkspaceShell>
      <h1 className="text-3xl font-semibold">AI Task Runner</h1>
      <p className="mt-2 text-sm text-slate-400">API: {api.baseUrl} · Socket: {SOCKET_URL}</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <label className="text-sm text-slate-400" htmlFor="task-repo">Repository</label>
          <select
            id="task-repo"
            value={repoId}
            onChange={(event) => setRepoId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 p-3 outline-none"
          >
            {repositories.length === 0 && <option value="repo_1">repo_1 fallback</option>}
            {repositories.map((repository) => <option key={repository.id} value={repository.id}>{repository.name}</option>)}
          </select>

          <label className="mt-4 block text-sm text-slate-400" htmlFor="task-prompt">Task input</label>
          <textarea
            id="task-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="mt-2 h-28 w-full rounded-xl border border-white/10 bg-black/30 p-4 outline-none"
          />
          <Button disabled={running || !prompt} onClick={runTask}>{running ? 'Running...' : 'Analyze & execute'}</Button>

          <h2 className="mt-6 font-semibold">Editable plan template</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
            {taskRuns[0].plan.map((step) => <li key={step}>{step}</li>)}
          </ol>
          {error && <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
        </Card>

        <Card>
          <h2 className="font-semibold">Live Execution</h2>
          <div className="mt-4 min-h-52 rounded-xl bg-black p-4 font-mono text-sm text-emerald-300">
            {logs.map((log, index) => <p key={`${log}-${index}`}>$ {log}</p>)}
          </div>
          <h2 className="mt-6 font-semibold">Backend response</h2>
          <pre className="mt-2 overflow-auto rounded-xl bg-white/5 p-3 text-xs text-slate-300">
            {task ? JSON.stringify(task, null, 2) : 'Run a task to see the FastAPI response.'}
          </pre>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
