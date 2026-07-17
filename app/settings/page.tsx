import { WorkspaceShell } from '@/components/workspace/shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Github, Key, Monitor, Bell } from 'lucide-react';

export default function Settings() {
  return (
    <WorkspaceShell>
      <div className="mb-8 max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Manage your workspace preferences and integrations.</p>
      </div>

      <div className="grid gap-6 max-w-4xl animate-fade-in">
        <Card>
          <div className="flex items-center gap-3 mb-6 border-b border-forge-border pb-4">
            <Github className="h-5 w-5 text-slate-300" />
            <h2 className="font-bold text-lg">GitHub Integration</h2>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Connect your GitHub account to allow CodexForge to clone repositories, read issues, and open pull requests.
          </p>
          <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-black/20">
            <div>
              <p className="font-medium text-sm">Authentication Status</p>
              <p className="text-xs text-slate-500 mt-1">Configured via environment variables.</p>
            </div>
            <Button variant="outline">Re-authenticate</Button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-6 border-b border-forge-border pb-4">
            <Key className="h-5 w-5 text-slate-300" />
            <h2 className="font-bold text-lg">AI Provider</h2>
          </div>
          <p className="text-sm text-slate-400 mb-6">
            Configure the LLM used for autonomous engineering tasks.
          </p>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1.5">OpenAI API Key</label>
              <Input type="password" value="sk-................................" readOnly />
              <p className="text-xs text-slate-500 mt-1.5">Key is set via server environment variable.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1.5">Model Override</label>
              <select className="flex h-10 w-full rounded-xl border border-forge-border bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-forge-accent">
                <option>gpt-5 (Default)</option>
                <option>gpt-5.1</option>
                <option>claude-sonnet-4.5</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button disabled>Save Changes</Button>
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Monitor className="h-5 w-5 text-slate-300" />
              <h2 className="font-bold">Appearance</h2>
            </div>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
                <span className="text-sm font-medium">Dark Mode</span>
                <div className="relative inline-flex h-5 w-9 items-center rounded-full bg-forge-accent">
                  <span className="inline-block h-4 w-4 translate-x-4 rounded-full bg-black transition" />
                </div>
              </label>
              <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
                <span className="text-sm font-medium">Compact Layout</span>
                <div className="relative inline-flex h-5 w-9 items-center rounded-full bg-slate-700">
                  <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white transition" />
                </div>
              </label>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Bell className="h-5 w-5 text-slate-300" />
              <h2 className="font-bold">Notifications</h2>
            </div>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
                <span className="text-sm font-medium">Browser Alerts</span>
                <div className="relative inline-flex h-5 w-9 items-center rounded-full bg-forge-accent">
                  <span className="inline-block h-4 w-4 translate-x-4 rounded-full bg-black transition" />
                </div>
              </label>
              <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
                <span className="text-sm font-medium">Task Completion</span>
                <div className="relative inline-flex h-5 w-9 items-center rounded-full bg-forge-accent">
                  <span className="inline-block h-4 w-4 translate-x-4 rounded-full bg-black transition" />
                </div>
              </label>
            </div>
          </Card>
        </div>
      </div>
    </WorkspaceShell>
  )
}
