"use client";

import { useEffect, useState, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, type BackendRepository, type BackendTask } from "@/lib/api";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Terminal, Github, Play, CheckCircle2, CircleDashed, Cpu, ListTree, Info } from "lucide-react";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Tasks() {
  const [prompt, setPrompt] = useState("Fix Issue #12");
  const [repositories, setRepositories] = useState<BackendRepository[]>([]);
  const [repoId, setRepoId] = useState("");
  const [task, setTask] = useState<BackendTask | null>(null);
  const [logs, setLogs] = useState<string[]>(["Waiting for backend task..."]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingRepositories, setLoadingRepositories] = useState(true);
  const [socketStatus, setSocketStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [hasPromptedInstall, setHasPromptedInstall] = useState(false);
  
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadRepositories() {
      try {
        const nextRepositories = await api.listRepositories();
        if (!cancelled) {
          setRepositories(nextRepositories);
          setRepoId((current) => current || nextRepositories[0]?.id || "");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load repositories");
      } finally {
        if (!cancelled) setLoadingRepositories(false);
      }
    }
    loadRepositories();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const socket: Socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socket.on("connect", () => {
      setSocketStatus("connected");
      setLogs((current) => [...current, `> System: Socket connected (${socket.id})`]);
    });
    socket.on("connect_error", (err) => {
      setSocketStatus("error");
      setLogs((current) => [...current, `> System Error: Socket disconnected (${err.message})`]);
    });
    socket.on("task:log", (event: { task_id: string; message: string }) => {
      setLogs((current) => [...current, `[${new Date().toLocaleTimeString()}] ${event.message}`]);
    });
    socket.on("task:status", (event: { task_id: string; status: string }) => {
      setTask((current) => current && current.id === event.task_id ? { ...current, status: event.status } : current);
    });
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (task?.status === "failed" && !hasPromptedInstall) {
      const hasPermissionError = logs.some(log => 
        log.includes("Resource not accessible by integration") || 
        log.includes("403") || 
        log.includes("Permission denied") ||
        log.includes("Not Found")
      );
      
      if (hasPermissionError) {
        setHasPromptedInstall(true);
        const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME;
        const installUrl = appName 
          ? `https://github.com/apps/${appName}/installations/new` 
          : "https://github.com/settings/installations";
        
        window.open(installUrl, "_blank");
      }
    }
  }, [task?.status, logs, hasPromptedInstall]);

  async function runTask() {
    try {
      setRunning(true);
      setError(null);
      setHasPromptedInstall(false);
      setLogs([`> Starting task execution...`]);
      const selectedRepoId = repoId || repositories[0]?.id;
      if (!selectedRepoId) throw new Error("Import a repository before running a task.");
      
      const createdTask = await api.createTask(selectedRepoId, prompt);
      setTask(createdTask);
      setLogs((current) => [...current, `> Backend recorded task ${createdTask.id} [${createdTask.status}]`]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Task failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <WorkspaceShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Task Runner</h1>
          <p className="mt-1 text-sm text-slate-400">Execute autonomous coding agents on your repositories.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={socketStatus === "connected" ? "success" : socketStatus === "error" ? "destructive" : "warning"}>
            <div className={`mr-1.5 h-1.5 w-1.5 rounded-full ${socketStatus === "connected" ? "bg-emerald-500 animate-pulse" : "bg-current"}`} />
            {socketStatus === "connected" ? "Live Stream Active" : socketStatus === "error" ? "Stream Offline" : "Connecting..."}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Config */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <Card>
            <div className="flex items-center gap-2 mb-4 border-b border-forge-border pb-4">
              <Cpu className="h-5 w-5 text-forge-accent" />
              <h2 className="font-bold">Task Configuration</h2>
            </div>
            
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-400">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Ensure your GitHub App is <a href="https://github.com/settings/installations" target="_blank" rel="noreferrer" className="underline hover:text-amber-300">installed</a> on the selected repository with <strong>Workflows</strong>, <strong>Contents</strong>, and <strong>Pull requests</strong> permissions.
              </p>
            </div>
            
            <label className="text-sm font-medium text-slate-300 mb-2 block">Repository</label>
            <select
              className="flex h-10 w-full rounded-xl border border-forge-border bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-forge-accent disabled:opacity-50"
              value={repoId}
              onChange={(event) => setRepoId(event.target.value)}
              disabled={loadingRepositories || repositories.length === 0}
            >
              {repositories.length === 0 && <option value="">Import a repository first</option>}
              {repositories.map((repo) => (
                <option key={repo.id} value={repo.id}>{repo.name}</option>
              ))}
            </select>

            <label className="mt-5 text-sm font-medium text-slate-300 mb-2 block">Instruction Prompt</label>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="w-full rounded-xl border border-forge-border bg-black/30 p-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-forge-accent min-h-[120px] resize-y"
              placeholder="E.g., Fix Issue #42 or Add authentication..."
            />
            
            <Button 
              className="w-full mt-4" 
              disabled={running || !prompt || !repoId || repositories.length === 0} 
              onClick={runTask}
              loading={running}
            >
              <Play className="mr-2 h-4 w-4" />
              Execute Task
            </Button>
            
            {error && <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4 border-b border-forge-border pb-4">
              <ListTree className="h-5 w-5 text-forge-accent" />
              <h2 className="font-bold">Execution Plan</h2>
            </div>
            {task?.plan ? (
              <div className="relative pl-6 border-l border-forge-border/50 ml-3 space-y-6 py-2">
                {task.plan.map((step, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full bg-forge-surface ring-4 ring-forge-bg">
                      <CheckCircle2 className="h-4 w-4 text-slate-500" />
                    </div>
                    <p className="text-sm font-medium text-slate-300">{step}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-slate-500">
                <CircleDashed className="mx-auto h-8 w-8 mb-2 opacity-20" />
                Plan will generate when task runs.
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Execution */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <Card className="flex flex-col flex-1 min-h-[500px] overflow-hidden p-0 border-forge-border bg-[#050505]">
            <div className="flex items-center justify-between border-b border-forge-border bg-forge-surface/50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-mono text-slate-300">
                <Terminal className="h-4 w-4 text-forge-accent" />
                terminal // codex-worker
              </div>
              {task && (
                <Badge variant={task.status === "finished" ? "success" : task.status === "running" ? "warning" : task.status === "failed" ? "destructive" : "default"}>
                  {task.status.toUpperCase()}
                </Badge>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed text-slate-300 space-y-1.5 h-[500px]">
              {logs.length === 0 && <span className="text-slate-600">Waiting for logs...</span>}
              {logs.map((log, index) => (
                <div key={index} className={`${log.startsWith('>') ? 'text-forge-teal font-medium' : ''}`}>
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </Card>

          {task?.prUrl && (
            <Card className="border-emerald-500/30 bg-emerald-500/5 animate-slide-up">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-emerald-500/20 p-2 mt-1">
                  <Github className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-400 text-lg">Pull Request Created Successfully</h3>
                  <p className="mt-1 text-sm text-slate-300 mb-3">The AI worker has committed changes and opened a pull request.</p>
                  <a href={task.prUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-emerald-400">
                    Review on GitHub
                  </a>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
