'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Github, Cpu, LogOut } from 'lucide-react';
import { WorkspaceShell } from '@/components/workspace/shell';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

export default function Profile() {
  const { user, setUser, logout } = useAuthStore();
  const router = useRouter();

  // Try to refetch user info on mount to ensure freshness
  useEffect(() => {
    api.authMe().then(res => {
      setUser(res);
    }).catch(console.error);
  }, [setUser]);

  function continueWithGitHub() {
    window.location.href = `${API_BASE_URL}/api/auth/github/login`;
  }

  async function handleLogout() {
    try {
      await api.authLogout();
      logout();
      router.push('/');
    } catch (err) {
      console.error(err);
    }
  }

  // If not logged in, show the login view
  if (!user) {
    return (
      <div className="min-h-screen bg-forge-bg flex items-center justify-center p-4 relative overflow-hidden">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.15),transparent_50%)]" />
        
        <div className="w-full max-w-md animate-fade-in">
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-forge-teal to-forge-accent flex items-center justify-center shadow-glow">
                <Cpu className="h-6 w-6 text-black" />
              </div>
              <span className="text-3xl font-bold tracking-tight text-white">
                Codex<span className="text-forge-accent">Forge</span>
              </span>
            </div>
          </div>

          <Card className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold tracking-tight mb-2">Welcome Back</h1>
              <p className="text-sm text-slate-400">
                Sign in to access your autonomous AI engineering workspace.
              </p>
            </div>
            
            <Button 
              className="w-full h-12 text-base font-medium bg-white text-black hover:bg-slate-200" 
              onClick={continueWithGitHub}
            >
              <Github className="mr-3 h-5 w-5" />
              Continue with GitHub
            </Button>
            
            <div className="mt-8 pt-6 border-t border-forge-border text-center">
              <p className="text-xs text-slate-500">
                Requires GitHub authorization to manage repositories and pull requests.
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // If logged in, show the Profile View
  return (
    <WorkspaceShell>
      <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Profile</h1>
            <p className="mt-1 text-sm text-slate-400">Connected GitHub account and activity.</p>
          </div>
          <Button variant="outline" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Disconnect
          </Button>
        </div>

        <Card className="mb-8 p-8 flex flex-col sm:flex-row items-center gap-6">
          <img src={user.avatar_url} alt={user.login} className="w-24 h-24 rounded-full border-4 border-forge-surface ring-2 ring-forge-accent/50" />
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold">{user.login}</h2>
            <p className="text-slate-400 mt-1">Authenticated via GitHub OAuth</p>
            <div className="mt-4 flex gap-3 justify-center sm:justify-start">
              <span className="px-3 py-1 bg-forge-accent/20 text-forge-accent text-xs font-semibold rounded-full border border-forge-accent/30">
                Read & Write Permissions
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Github className="h-5 w-5 text-forge-accent" />
            <h3 className="font-bold text-lg">Contribution Activity</h3>
          </div>
          
          <div className="overflow-x-auto pb-4">
            <div className="min-w-[700px] flex justify-center bg-black/20 rounded-xl p-4 border border-white/5">
              <img 
                src={`https://ghchart.rshah.org/10b981/${user.login}`} 
                alt={`${user.login}'s Github Chart`} 
                className="select-none pointer-events-none w-full"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 text-center mt-2">
            This graph pulls your public contributions directly from GitHub.
          </p>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
