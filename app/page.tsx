import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { WorkspaceShell } from '@/components/workspace/shell';

const highlights = [
  'Architecture graph',
  'Live task runner',
  'Diff + PR workflow',
];

export default function Home() {
  return (
    <WorkspaceShell>
      <section className="mx-auto max-w-6xl py-20">
        <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-cyan-200">
          Codex Cloud orchestration for real codebases
        </div>
        <h1 className="max-w-4xl text-5xl font-semibold tracking-tight md:text-6xl">
          Import a repository. Plan the fix. Stream autonomous engineering work.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-400">
          CodexForge combines repository intelligence, editable AI plans, live execution logs, test retries,
          diff review, and pull request generation in one premium workspace.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/dashboard"><Button>Open dashboard</Button></Link>
          <Link href="/repositories"><Button className="bg-white/10 text-white hover:bg-white/20">Import repo</Button></Link>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {highlights.map((highlight) => (
            <Card key={highlight}>
              <h3 className="font-semibold">{highlight}</h3>
              <p className="mt-2 text-sm text-slate-400">
                Production-ready interaction patterns with typed APIs, loading states, and resilient UX.
              </p>
            </Card>
          ))}
        </div>
      </section>
    </WorkspaceShell>
  );
}
