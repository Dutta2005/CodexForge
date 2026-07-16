'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { repositories } from '@/lib/mock-data';
import { WorkspaceShell } from '@/components/workspace/shell';

export default function Repositories() {
  const [url, setUrl] = useState('https://github.com/openai/example');
  const [items, setItems] = useState(repositories);

  function importRepository() {
    setItems([
      {
        ...repositories[0],
        id: String(Date.now()),
        url,
        name: url.split('/').pop() || 'repository',
      },
      ...items,
    ]);
  }

  return (
    <WorkspaceShell>
      <h1 className="text-3xl font-semibold">Repository Import</h1>
      <Card className="mt-6">
        <label className="text-sm text-slate-400" htmlFor="repo-url">GitHub repository URL</label>
        <div className="mt-2 flex flex-col gap-3 md:flex-row">
          <input
            id="repo-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2 outline-none"
          />
          <Button onClick={importRepository}>Clone & analyze</Button>
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Reads package files, detects frameworks, languages, dependencies, routes, and generates an architecture summary.
        </p>
      </Card>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {items.map((repository) => (
          <Card key={repository.id}>
            <h2 className="font-semibold">{repository.name}</h2>
            <p className="text-sm text-slate-400">{repository.url}</p>
            <p className="mt-3">{repository.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {repository.dependencies.map((dependency) => (
                <span className="rounded-full bg-white/10 px-2 py-1 text-xs" key={dependency}>{dependency}</span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </WorkspaceShell>
  );
}
