import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, FileDiff } from 'lucide-react';

export function DiffViewer({ diff, onApprove, onReject }: { diff: string, onApprove: () => void, onReject: () => void }) {
  const lines = diff.split('\n');

  return (
    <Card className="flex flex-col h-full border-forge-border p-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-forge-border bg-forge-surface/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <FileDiff className="h-4 w-4 text-forge-accent" />
          <h3 className="font-semibold text-sm">Review Proposed Changes</h3>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="destructive" onClick={onReject}>
            <X className="mr-1 h-3 w-3" /> Reject
          </Button>
          <Button size="sm" onClick={onApprove} className="bg-emerald-500 text-black hover:bg-emerald-400">
            <Check className="mr-1 h-3 w-3" /> Approve & PR
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-[#0a0a0f] p-4 text-xs font-mono leading-relaxed">
        {lines.map((line, i) => {
          let className = "text-slate-300";
          let bgClass = "";
          if (line.startsWith('+')) {
            className = "text-emerald-400 font-medium";
            bgClass = "bg-emerald-500/10 block px-2 -mx-2";
          } else if (line.startsWith('-')) {
            className = "text-red-400 font-medium";
            bgClass = "bg-red-500/10 block px-2 -mx-2";
          } else if (line.startsWith('@@')) {
            className = "text-forge-teal font-medium mt-2 mb-1 opacity-70";
          }

          return (
            <span key={i} className={`${className} ${bgClass} whitespace-pre-wrap`}>
              {line}{'\n'}
            </span>
          );
        })}
      </div>
    </Card>
  );
}
