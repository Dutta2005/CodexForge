'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type BackendTask } from '@/lib/api';
import { WorkspaceShell } from '@/components/workspace/shell';
import { Terminal, Calendar, Clock, ArrowRight } from 'lucide-react';

export default function History() {
  const [tasks, setTasks] = useState<BackendTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listTasks()
      .then(setTasks)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <WorkspaceShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Run History</h1>
        <p className="mt-1 text-sm text-slate-400">Past AI task executions and logs.</p>
      </div>
      
      {error && <div className="mb-8 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">{error}</div>}

      <div className="max-w-4xl space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-forge-accent/50 before:to-transparent">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-forge-border bg-forge-bg shadow-[0_0_0_4px_#0a0a0f] md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                <div className="h-3 w-3 rounded-full bg-slate-700" />
              </div>
              <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)]"><Skeleton className="h-24 w-full" /></Card>
            </div>
          ))
        ) : tasks.length === 0 ? (
          <div className="pl-14 md:pl-0 md:text-center text-slate-500 py-10">No run history found.</div>
        ) : (
          tasks.map((task, index) => {
            const date = new Date(task.createdAt * 1000);
            return (
              <div key={task.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-forge-border bg-forge-bg shadow-[0_0_0_4px_#0a0a0f] md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  <div className={`h-3 w-3 rounded-full ${task.status === 'finished' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : task.status === 'failed' ? 'bg-red-500' : 'bg-forge-accent'}`} />
                </div>
                
                <Card className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] hover:border-forge-accent/30 transition-colors">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-base truncate pr-2">{task.title}</h3>
                      <Badge variant={task.status === 'finished' ? 'success' : task.status === 'failed' ? 'destructive' : 'default'} className="shrink-0">
                        {task.status}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{date.toLocaleDateString()}</div>
                      <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{date.toLocaleTimeString()}</div>
                      <div className="flex items-center gap-1.5"><Terminal className="h-3.5 w-3.5" />{task.id.substring(0, 12)}...</div>
                    </div>
                    
                    <div className="mt-3 rounded-lg bg-black/40 p-3">
                      <p className="text-xs font-mono text-slate-400 line-clamp-3">
                        {task.logs[task.logs.length - 1] || 'No logs available.'}
                      </p>
                    </div>
                    
                    {task.prUrl && (
                      <a href={task.prUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-emerald-400 hover:text-emerald-300">
                        View PR <ArrowRight className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </Card>
              </div>
            );
          })
        )}
      </div>
    </WorkspaceShell>
  );
}
