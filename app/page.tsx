import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { WorkspaceShell } from '@/components/workspace/shell';
import { Network, Terminal, GitPullRequest } from 'lucide-react';

const highlights = [
  {
    title: 'Architecture graph',
    description: 'Auto-generate dependency graphs and relationship maps of any imported codebase.',
    icon: Network,
  },
  {
    title: 'Live task runner',
    description: 'Stream autonomous engineering work live with real-time logs and progress.',
    icon: Terminal,
  },
  {
    title: 'Diff + PR workflow',
    description: 'Review inline code diffs before automatically creating pull requests.',
    icon: GitPullRequest,
  }
];

export default function Home() {
  return (
    <WorkspaceShell>
      <section className="mx-auto max-w-6xl py-12 md:py-24 animate-fade-in">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-forge-border bg-forge-surface px-4 py-1.5 text-sm font-medium text-forge-teal">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-forge-teal opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-forge-teal"></span>
          </span>
          Codex Cloud orchestration for real codebases
        </div>
        
        <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
          Import a repository.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-forge-teal to-forge-accent">Plan the fix.</span><br />
          Stream engineering.
        </h1>
        
        <p className="mt-6 max-w-2xl text-lg text-slate-400 leading-relaxed">
          CodexForge combines repository intelligence, editable AI plans, live execution logs, test retries,
          diff review, and pull request generation in one premium workspace.
        </p>
        
        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link href="/dashboard">
            <Button size="lg" className="w-full sm:w-auto text-base">Open Dashboard</Button>
          </Link>
          <Link href="/repositories">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto text-base">Import Repository</Button>
          </Link>
        </div>
        
        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {highlights.map((highlight, index) => (
            <div key={highlight.title} className="animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
              <Card className="h-full">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-forge-accent/10">
                  <highlight.icon className="h-5 w-5 text-forge-accent" />
                </div>
                <h3 className="font-bold text-lg">{highlight.title}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  {highlight.description}
                </p>
              </Card>
            </div>
          ))}
        </div>
      </section>
    </WorkspaceShell>
  );
}
