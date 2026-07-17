"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, type BackendRepository, type BackendTask } from "@/lib/api";
import { WorkspaceShell } from "@/components/workspace/shell";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

export default function Tasks() {
  const [prompt, setPrompt] = useState("Fix Issue #12");
  const [repositories, setRepositories] = useState<BackendRepository[]>([]);
  const [repoId, setRepoId] = useState("");
  const [task, setTask] = useState<BackendTask | null>(null);
  const [logs, setLogs] = useState<string[]>(["Waiting for backend task..."]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingRepositories, setLoadingRepositories] = useState(true);
  const [socketStatus, setSocketStatus] = useState<
    "connecting" | "connected" | "error"
  >("connecting");

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
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Could not load repositories",
          );
      } finally {
        if (!cancelled) setLoadingRepositories(false);
      }
    }

    loadRepositories();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const socket: Socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setSocketStatus("connected");
      setLogs((current) => [...current, `Socket connected: ${socket.id}`]);
    });
    socket.on("connect_error", (err) => {
      setSocketStatus("error");
      setLogs((current) => [...current, `Socket error: ${err.message}`]);
    });
    socket.on("task:log", (event: { task_id: string; message: string }) => {
      setLogs((current) => [...current, `[${event.task_id}] ${event.message}`]);
    });
    socket.on(
      "task:status",
      (event: { task_id: string; status: string }) => {
        setTask((current) =>
          current && current.id === event.task_id
            ? { ...current, status: event.status }
            : current,
        );
      },
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  async function runTask() {
    try {
      setRunning(true);
      setError(null);
      setLogs(["Submitting task to backend..."]);
      const selectedRepoId = repoId || repositories[0]?.id;
      if (!selectedRepoId) {
        throw new Error("Import a repository before running a task.");
      }
      const createdTask = await api.createTask(selectedRepoId, prompt);
      setTask(createdTask);
      setLogs((current) => [
        ...current,
        `Backend returned ${createdTask.status}: ${createdTask.title}`,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Task failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <WorkspaceShell>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">AI Task Runner</h1>
          <p className="mt-2 text-sm text-slate-400">
            Submit a repository task, watch the event stream, and inspect the
            backend response.
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
          {loadingRepositories
            ? "Loading repositories..."
            : repositories.length
              ? `${repositories.length} ${repositories.length === 1 ? "repository" : "repositories"} ready`
              : "No repository selected"}
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-400">
        API: {api.baseUrl} · Socket: {SOCKET_URL} ·{" "}
        {socketStatus === "connected"
          ? "Live stream connected"
          : socketStatus === "error"
            ? "Socket disconnected"
            : "Connecting..."}
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <label className="text-sm text-slate-400" htmlFor="task-repo">
            Repository
          </label>
          <select
            id="task-repo"
            value={repoId}
            onChange={(event) => setRepoId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 p-3 outline-none"
            disabled={loadingRepositories || repositories.length === 0}
          >
            {repositories.length === 0 && (
              <option value="">Import a repository first</option>
            )}
            {repositories.map((repository) => (
              <option key={repository.id} value={repository.id}>
                {repository.name}
              </option>
            ))}
          </select>

          <label
            className="mt-4 block text-sm text-slate-400"
            htmlFor="task-prompt"
          >
            Task input
          </label>
          <textarea
            id="task-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="mt-2 h-28 w-full rounded-xl border border-white/10 bg-black/30 p-4 outline-none"
          />
          <Button
            disabled={
              running || !prompt || !repoId || repositories.length === 0
            }
            onClick={runTask}
          >
            {running ? "Running..." : "Analyze & execute"}
          </Button>

          <h2 className="mt-6 font-semibold">Backend plan</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
            {(
              task?.plan ?? ["Submit a task to generate the backend plan."]
            ).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {!running && repositories.length === 0 && (
            <p className="mt-3 rounded-xl bg-black/20 p-3 text-sm text-slate-400">
              Import a repository first so the runner can point at real backend
              data.
            </p>
          )}
          {error && (
            <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">
              {error}
            </p>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold">Live Execution</h2>
          <div className="mt-4 min-h-52 rounded-xl bg-black p-4 font-mono text-sm text-emerald-300">
            {logs.length === 0 && <p>$ Waiting for live logs...</p>}
            {logs.map((log, index) => (
              <p key={`${log}-${index}`}>$ {log}</p>
            ))}
          </div>
          {task?.prUrl && (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <h2 className="font-semibold text-emerald-300">✅ Pull Request Created</h2>
              <a
                href={task.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-emerald-400 underline hover:text-emerald-300 transition-colors"
              >
                {task.prUrl}
              </a>
            </div>
          )}
          {task && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-slate-400">Status:</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  task.status === "finished"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : task.status === "running"
                      ? "bg-amber-500/20 text-amber-300 animate-pulse"
                      : task.status === "failed"
                        ? "bg-rose-500/20 text-rose-300"
                        : "bg-blue-500/20 text-blue-300"
                }`}
              >
                {task.status}
              </span>
            </div>
          )}
          <h2 className="mt-6 font-semibold">Backend response</h2>
          <pre className="mt-2 overflow-auto rounded-xl bg-white/5 p-3 text-xs text-slate-300">
            {task
              ? JSON.stringify(task, null, 2)
              : "Run a task to see the FastAPI response."}
          </pre>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
