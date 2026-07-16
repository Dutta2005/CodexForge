import Link from 'next/link';
import type { ReactNode } from 'react';

const navigation = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/repositories', label: 'Repositories' },
  { href: '/architecture', label: 'Architecture' },
  { href: '/tasks', label: 'AI Tasks' },
  { href: '/history', label: 'History' },
  { href: '/settings', label: 'Settings' },
];

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-forge-bg text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,.25),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,.16),transparent_28%)]" />
      <aside className="fixed left-0 top-0 hidden h-full w-64 border-r border-white/10 bg-black/30 p-6 backdrop-blur-xl lg:block">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          Codex<span className="text-forge-cyan">Forge</span>
        </Link>
        <p className="mt-2 text-xs uppercase tracking-[0.3em] text-slate-500">Cloud IDE</p>
        <nav className="mt-10 grid gap-2">
          {navigation.map((item) => (
            <Link
              className="rounded-xl px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="lg:pl-64">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-forge-bg/70 px-6 py-4 backdrop-blur">
          <span className="text-sm text-slate-400">AI Engineering Workspace</span>
          <Link href="/login" className="rounded-full border border-white/10 px-4 py-2 text-sm transition hover:bg-white/10">
            GitHub OAuth
          </Link>
        </header>
        <section className="p-6">{children}</section>
      </main>
    </div>
  );
}
