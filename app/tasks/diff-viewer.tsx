'use client';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
const Monaco = dynamic(() => import('@monaco-editor/react').then((mod) => mod.DiffEditor), { ssr: false });
export function DiffViewer(){const before='const retries = 0;\ncheckout();'; const after='const retries = state.retries ?? 0;\nawait checkout({ idempotencyKey });';return <Card><h2 className="font-semibold">Code Diff Viewer</h2><div className="mt-4 h-80 overflow-hidden rounded-xl"><Monaco height="320px" language="typescript" original={before} modified={after} theme="vs-dark" options={{readOnly:true}} /></div><div className="mt-4 flex gap-2"><button className="rounded-xl bg-emerald-400 px-3 py-2 text-sm text-black">Accept</button><button className="rounded-xl bg-rose-400 px-3 py-2 text-sm text-black">Reject</button></div></Card>}
