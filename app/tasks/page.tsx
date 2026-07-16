'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { taskRuns } from '@/lib/mock-data';
import { WorkspaceShell } from '@/components/workspace/shell';

const activeLogs = [
  'Analyzing issue...',
  'Searching codebase...',
  'Creating execution plan...',
  'Editing files through Codex...',
  'Running Tests...',
  'Retrying failed tests if possible...',
  'Generating Commit...',
  'Finished...',
];

export default function Tasks() {
  const [prompt, setPrompt] = useState('Fix Issue #12');
  const [running, setRunning] = useState(false);
  const logs = useMemo(() => (running ? activeLogs : taskRuns[0].logs), [running]);

  return (
    <WorkspaceShell>
      <h1 className="text-3xl font-semibold">AI Task Runner</h1>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <label className="text-sm text-slate-400" htmlFor="task-prompt">Task input</label>
          <textarea
            id="task-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="mt-2 h-28 w-full rounded-xl border border-white/10 bg-black/30 p-4 outline-none"
          />
          <Button onClick={() => setRunning(true)}>Analyze & execute</Button>
          <h2 className="mt-6 font-semibold">Editable plan</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
            {taskRuns[0].plan.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </Card>
        <Card>
          <h2 className="font-semibold">Live Execution</h2>
          <div className="mt-4 rounded-xl bg-black p-4 font-mono text-sm text-emerald-300">
            {logs.map((log) => <p key={log}>$ {log}</p>)}
          </div>
          <h2 className="mt-6 font-semibold">Modified files</h2>
          {taskRuns[0].filesChanged.map((file) => (
            <p className="mt-2 rounded-lg bg-white/5 p-2 text-sm" key={file}>{file}</p>
          ))}
        </Card>
      </div>
    </WorkspaceShell>
  );
}
