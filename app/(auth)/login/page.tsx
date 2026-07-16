'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { WorkspaceShell } from '@/components/workspace/shell';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export default function Login() {
  function continueWithGitHub() {
    window.location.href = `${API_BASE_URL}/api/auth/github/login`;
  }

  return (
    <WorkspaceShell>
      <div className="mx-auto max-w-md py-20">
        <Card>
          <h1 className="text-2xl font-semibold">Sign in with GitHub</h1>
          <p className="mt-3 text-slate-400">
            Connect GitHub to authorize repository access, issue lookup, branches, commits, and pull request workflows.
          </p>
          <Button className="mt-6 w-full" onClick={continueWithGitHub}>Continue with GitHub</Button>
          <p className="mt-3 text-xs text-slate-500">OAuth starts at {API_BASE_URL}/api/auth/github/login</p>
        </Card>
      </div>
    </WorkspaceShell>
  );
}
