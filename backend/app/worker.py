"""Background worker that processes queued AI tasks.

Polls the database for tasks with status='queued', fetches GitHub issue context,
calls the OpenAI API to generate code fixes, and creates pull requests.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import re
import time
import traceback
from typing import Any, Sequence
from urllib.parse import urlparse

import httpx

try:
    from openai import AsyncOpenAI
except ImportError:  # pragma: no cover
    AsyncOpenAI = None  # type: ignore[assignment,misc]

logger = logging.getLogger('codexforge.worker')

POLL_INTERVAL_SECONDS = 5
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o')
GITHUB_API = 'https://api.github.com'


def _parse_owner_repo(url: str) -> tuple[str, str] | None:
    """Extract (owner, repo) from a GitHub URL like https://github.com/owner/repo."""
    parsed = urlparse(url)
    parts = [p for p in parsed.path.strip('/').split('/') if p]
    if len(parts) >= 2:
        repo_name = parts[1].removesuffix('.git')
        return parts[0], repo_name
    return None


def _extract_issue_number(prompt: str) -> int | None:
    """Try to parse an issue number from the task prompt (e.g. '#12', 'Issue #12')."""
    match = re.search(r'#(\d+)', prompt)
    return int(match.group(1)) if match else None


class TaskWorker:
    """Async background worker that processes AI tasks."""

    def __init__(
        self,
        *,
        sio: Any,
        db_helpers: dict[str, Any],
        codex_api_key: str,
    ) -> None:
        self.sio = sio
        self.codex_api_key = codex_api_key
        # DB helpers passed from main.py so we share the same connection logic
        self._connection = db_helpers['connection']
        self._execute = db_helpers['execute']
        self._fetch_all = db_helpers['fetch_all']
        self._running = False
        self._http: httpx.AsyncClient | None = None
        self._openai: Any = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Launch the polling loop as a background task."""
        self._running = True
        self._http = httpx.AsyncClient(timeout=60)
        if AsyncOpenAI is not None:
            self._openai = AsyncOpenAI(api_key=self.codex_api_key)
        else:
            logger.warning('openai package not installed — worker will not be able to generate code fixes')
        asyncio.create_task(self._poll_loop())
        logger.info('TaskWorker started — polling every %ds', POLL_INTERVAL_SECONDS)

    async def stop(self) -> None:
        self._running = False
        if self._http:
            await self._http.aclose()

    # ------------------------------------------------------------------
    # Polling
    # ------------------------------------------------------------------

    async def _poll_loop(self) -> None:
        while self._running:
            try:
                await self._process_next_task()
            except Exception:
                logger.exception('Unhandled error in worker poll loop')
            await asyncio.sleep(POLL_INTERVAL_SECONDS)

    async def _process_next_task(self) -> None:
        """Pick one queued task and process it end-to-end."""
        with self._connection() as conn:
            rows = self._fetch_all(
                conn,
                'select id, repo_id, prompt from tasks where status=? order by created_at asc limit 1',
                ('queued',),
            )
        if not rows:
            return

        task_id, repo_id, prompt = rows[0]
        logger.info('Picked up task %s for repo %s', task_id, repo_id)

        try:
            await self._run_task(task_id, repo_id, prompt)
        except Exception as exc:
            tb = traceback.format_exc()
            error_msg = f'Worker error: {exc}'
            logger.error('Task %s failed: %s\n%s', task_id, exc, tb)
            await self._update_task(task_id, status='failed', log=error_msg)
            await self._emit_log(task_id, error_msg)

    # ------------------------------------------------------------------
    # Core task execution
    # ------------------------------------------------------------------

    async def _run_task(self, task_id: str, repo_id: str, prompt: str) -> None:
        # 1. Mark running
        await self._update_task(task_id, status='running')
        await self._emit_log(task_id, 'Task picked up by worker — starting...')

        # 2. Load repo metadata and find its GitHub token
        with self._connection() as conn:
            repo_rows = self._fetch_all(
                conn,
                'select url, github_token from repositories where id=?',
                (repo_id,),
            )
        if not repo_rows:
            raise RuntimeError(f'Repository {repo_id} not found')

        repo_url, github_token = repo_rows[0]
        if not github_token:
            # Fallback: try to find any stored user token
            with self._connection() as conn:
                user_rows = self._fetch_all(conn, 'select github_token from users order by updated_at desc limit 1')
            if user_rows and user_rows[0][0]:
                github_token = user_rows[0][0]
            else:
                raise RuntimeError('No GitHub token available — please authenticate via GitHub OAuth first')

        owner_repo = _parse_owner_repo(repo_url)
        if not owner_repo:
            raise RuntimeError(f'Cannot parse owner/repo from URL: {repo_url}')
        owner, repo_name = owner_repo

        # 3. Fetch issue details (if prompt references one)
        issue_number = _extract_issue_number(prompt)
        issue_context = ''
        if issue_number:
            await self._emit_log(task_id, f'Fetching issue #{issue_number} from GitHub...')
            issue_context = await self._fetch_issue(owner, repo_name, issue_number, github_token)
        else:
            await self._emit_log(task_id, 'No issue number found in prompt — using prompt as-is')

        # 4. Fetch repo file tree for context
        await self._emit_log(task_id, 'Fetching repository file tree...')
        file_tree = await self._fetch_file_tree(owner, repo_name, github_token)

        # 5. Fetch key source files for context (README, package.json, etc.)
        await self._emit_log(task_id, 'Gathering key source files for context...')
        source_context = await self._fetch_key_files(owner, repo_name, github_token, file_tree)

        # 6. Call OpenAI to generate the fix
        await self._emit_log(task_id, f'Generating code fix with OpenAI ({OPENAI_MODEL})...')
        ai_result = await self._generate_fix(prompt, issue_context, file_tree, source_context, owner, repo_name)

        if not ai_result.get('files'):
            raise RuntimeError('OpenAI did not produce any file changes')

        await self._emit_log(task_id, f'AI produced changes to {len(ai_result["files"])} file(s)')

        # 7. Get default branch
        default_branch = await self._get_default_branch(owner, repo_name, github_token)

        # 8. Create a branch
        branch_name = f'codexforge/task-{task_id}'
        await self._emit_log(task_id, f'Creating branch {branch_name}...')
        await self._create_branch(owner, repo_name, branch_name, default_branch, github_token)

        # 9. Commit files
        await self._emit_log(task_id, 'Committing changes...')
        files_changed = []
        for file_change in ai_result['files']:
            file_path = file_change['path']
            file_content = file_change['content']
            await self._commit_file(owner, repo_name, branch_name, file_path, file_content, f'fix: {prompt}', github_token)
            files_changed.append(file_path)

        # 10. Open PR
        await self._emit_log(task_id, 'Opening pull request...')
        pr_title = ai_result.get('pr_title', f'CodexForge: {prompt}')
        pr_body = ai_result.get('pr_body', f'Automated fix generated by CodexForge AI worker.\n\nPrompt: {prompt}')
        if issue_number:
            pr_body += f'\n\nCloses #{issue_number}'
        pr_url = await self._create_pr(owner, repo_name, branch_name, default_branch, pr_title, pr_body, github_token)

        # 11. Finish
        await self._update_task(
            task_id,
            status='finished',
            log=f'PR created: {pr_url}',
            files_changed=files_changed,
            pr_url=pr_url,
        )
        await self._emit_log(task_id, f'✅ Task finished — PR: {pr_url}')

    # ------------------------------------------------------------------
    # GitHub API helpers
    # ------------------------------------------------------------------

    def _gh_headers(self, token: str) -> dict[str, str]:
        return {
            'Authorization': f'Bearer {token}',
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        }

    def _gh_raise(self, resp: httpx.Response, context: str = '') -> None:
        """Raise with the actual GitHub error message instead of just the status code."""
        if resp.is_success:
            return
        try:
            body = resp.json()
            message = body.get('message', resp.text)
            docs_url = body.get('documentation_url', '')
        except Exception:
            message = resp.text
            docs_url = ''
        detail = f'GitHub API error ({resp.status_code}): {message}'
        if docs_url:
            detail += f' — see {docs_url}'
        if context:
            detail = f'{context}: {detail}'
        logger.error(detail)
        raise RuntimeError(detail)

    async def _fetch_issue(self, owner: str, repo: str, number: int, token: str) -> str:
        resp = await self._http.get(  # type: ignore[union-attr]
            f'{GITHUB_API}/repos/{owner}/{repo}/issues/{number}',
            headers=self._gh_headers(token),
        )
        if resp.status_code == 404:
            return f'Issue #{number} not found.'
        self._gh_raise(resp, f'Fetching issue #{number}')
        data = resp.json()
        title = data.get('title', '')
        body = data.get('body', '') or ''
        labels = ', '.join(l.get('name', '') for l in data.get('labels', []))
        return f'Issue #{number}: {title}\nLabels: {labels}\n\n{body}'

    async def _fetch_file_tree(self, owner: str, repo: str, token: str) -> str:
        resp = await self._http.get(  # type: ignore[union-attr]
            f'{GITHUB_API}/repos/{owner}/{repo}/git/trees/HEAD?recursive=1',
            headers=self._gh_headers(token),
        )
        self._gh_raise(resp, 'Fetching file tree')
        tree = resp.json().get('tree', [])
        # Filter to just files, limit to avoid massive context
        paths = [item['path'] for item in tree if item.get('type') == 'blob'][:200]
        return '\n'.join(paths)

    async def _fetch_key_files(self, owner: str, repo: str, token: str, file_tree: str) -> str:
        """Fetch content of a few key files to give the AI better context."""
        key_files = []
        all_paths = file_tree.split('\n')

        # Prioritized file patterns
        priority_patterns = [
            'README.md', 'readme.md',
            'package.json', 'requirements.txt', 'pyproject.toml',
            'tsconfig.json', 'Cargo.toml', 'go.mod',
        ]

        # Find matching files
        files_to_fetch = []
        for pattern in priority_patterns:
            for path in all_paths:
                if path.endswith(pattern) and path.count('/') <= 1:
                    files_to_fetch.append(path)
                    break

        # Also grab a few source files (not too many)
        source_extensions = ('.py', '.ts', '.tsx', '.js', '.jsx', '.go', '.rs', '.java')
        source_files = [p for p in all_paths if any(p.endswith(ext) for ext in source_extensions) and p.count('/') <= 2]
        files_to_fetch.extend(source_files[:10])

        # Deduplicate
        files_to_fetch = list(dict.fromkeys(files_to_fetch))[:15]

        for file_path in files_to_fetch:
            try:
                resp = await self._http.get(  # type: ignore[union-attr]
                    f'{GITHUB_API}/repos/{owner}/{repo}/contents/{file_path}',
                    headers=self._gh_headers(token),
                )
                if resp.status_code == 200:
                    data = resp.json()
                    content = data.get('content', '')
                    if content and data.get('encoding') == 'base64':
                        decoded = base64.b64decode(content).decode('utf-8', errors='replace')
                        # Truncate very large files
                        if len(decoded) > 3000:
                            decoded = decoded[:3000] + '\n... (truncated)'
                        key_files.append(f'--- {file_path} ---\n{decoded}')
            except Exception:
                pass  # Skip files that fail to fetch

        return '\n\n'.join(key_files)

    async def _get_default_branch(self, owner: str, repo: str, token: str) -> str:
        resp = await self._http.get(  # type: ignore[union-attr]
            f'{GITHUB_API}/repos/{owner}/{repo}',
            headers=self._gh_headers(token),
        )
        self._gh_raise(resp, 'Fetching repo info')
        return resp.json().get('default_branch', 'main')

    async def _create_branch(self, owner: str, repo: str, branch: str, base: str, token: str) -> None:
        # Get the SHA of the base branch
        resp = await self._http.get(  # type: ignore[union-attr]
            f'{GITHUB_API}/repos/{owner}/{repo}/git/refs/heads/{base}',
            headers=self._gh_headers(token),
        )
        self._gh_raise(resp, f'Getting SHA of {base}')
        sha = resp.json()['object']['sha']

        # Create the new branch
        resp = await self._http.post(  # type: ignore[union-attr]
            f'{GITHUB_API}/repos/{owner}/{repo}/git/refs',
            headers=self._gh_headers(token),
            json={'ref': f'refs/heads/{branch}', 'sha': sha},
        )
        if resp.status_code == 422 and 'Reference already exists' in resp.text:
            logger.info('Branch %s already exists, reusing', branch)
            return
        self._gh_raise(resp, f'Creating branch {branch}')

    async def _commit_file(
        self, owner: str, repo: str, branch: str, path: str, content: str, message: str, token: str
    ) -> None:
        # Check if the file already exists to get its SHA (needed for updates)
        existing_sha = None
        resp = await self._http.get(  # type: ignore[union-attr]
            f'{GITHUB_API}/repos/{owner}/{repo}/contents/{path}?ref={branch}',
            headers=self._gh_headers(token),
        )
        if resp.status_code == 200:
            existing_sha = resp.json().get('sha')

        payload: dict[str, Any] = {
            'message': message,
            'content': base64.b64encode(content.encode('utf-8')).decode('ascii'),
            'branch': branch,
        }
        if existing_sha:
            payload['sha'] = existing_sha

        resp = await self._http.put(  # type: ignore[union-attr]
            f'{GITHUB_API}/repos/{owner}/{repo}/contents/{path}',
            headers=self._gh_headers(token),
            json=payload,
        )
        self._gh_raise(resp, f'Committing {path}')

    async def _create_pr(
        self, owner: str, repo: str, head: str, base: str, title: str, body: str, token: str
    ) -> str:
        resp = await self._http.post(  # type: ignore[union-attr]
            f'{GITHUB_API}/repos/{owner}/{repo}/pulls',
            headers=self._gh_headers(token),
            json={'title': title, 'body': body, 'head': head, 'base': base},
        )
        self._gh_raise(resp, 'Creating pull request')
        return resp.json().get('html_url', '')

    # ------------------------------------------------------------------
    # OpenAI
    # ------------------------------------------------------------------

    async def _generate_fix(
        self,
        prompt: str,
        issue_context: str,
        file_tree: str,
        source_context: str,
        owner: str,
        repo: str,
    ) -> dict[str, Any]:
        """Call OpenAI to generate a code fix. Returns dict with 'files', 'pr_title', 'pr_body'."""
        if self._openai is None:
            raise RuntimeError('OpenAI client is not available — install the openai package')

        system_prompt = f"""You are CodexForge, an AI coding agent. You are working on the GitHub repository {owner}/{repo}.

Your job is to resolve the user's request by producing code changes. You MUST respond with a valid JSON object containing:
- "pr_title": a concise PR title
- "pr_body": a markdown PR description explaining what was changed and why
- "files": an array of objects, each with:
  - "path": the file path relative to the repo root
  - "content": the COMPLETE new content of the file (not a diff — the full file)

Rules:
- Only modify files that need changes. Do not rewrite files unnecessarily.
- If creating a new file, provide the full content.
- If modifying an existing file, provide the COMPLETE updated file content.
- Be precise and minimal in your changes.
- Write production-quality code with proper error handling.
- Do NOT include any text outside the JSON object. Your entire response must be valid JSON.

Repository file tree:
{file_tree[:4000]}
"""

        user_message = f"""Please resolve the following:

{prompt}

{f'GitHub Issue Context:{chr(10)}{issue_context}' if issue_context else ''}

{f'Relevant source files:{chr(10)}{source_context[:8000]}' if source_context else ''}
"""

        response = await self._openai.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_message},
            ],
            temperature=0.2,
            response_format={'type': 'json_object'},
        )

        content = response.choices[0].message.content or '{}'

        try:
            result = json.loads(content)
        except json.JSONDecodeError:
            # Try to extract JSON from the response
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                result = json.loads(json_match.group())
            else:
                raise RuntimeError(f'OpenAI returned invalid JSON: {content[:500]}')

        if 'files' not in result or not isinstance(result['files'], list):
            raise RuntimeError(f'OpenAI response missing "files" array: {content[:500]}')

        return result

    # ------------------------------------------------------------------
    # DB + Socket helpers
    # ------------------------------------------------------------------

    async def _update_task(
        self,
        task_id: str,
        *,
        status: str | None = None,
        log: str | None = None,
        files_changed: list[str] | None = None,
        pr_url: str | None = None,
    ) -> None:
        with self._connection() as conn:
            if status:
                self._execute(conn, 'update tasks set status=? where id=?', (status, task_id))
            if log:
                # Append to existing logs
                rows = self._fetch_all(conn, 'select logs from tasks where id=?', (task_id,))
                if rows:
                    existing_logs = json.loads(rows[0][0])
                    existing_logs.append(log)
                    self._execute(conn, 'update tasks set logs=? where id=?', (json.dumps(existing_logs), task_id))
            if files_changed is not None:
                self._execute(conn, 'update tasks set files_changed=? where id=?', (json.dumps(files_changed), task_id))
            if pr_url is not None:
                self._execute(conn, 'update tasks set pr_url=? where id=?', (pr_url, task_id))

    async def _emit_log(self, task_id: str, message: str) -> None:
        logger.info('[%s] %s', task_id, message)
        try:
            await self.sio.emit('task:log', {'task_id': task_id, 'message': message})
            await self.sio.emit('task:status', {'task_id': task_id, 'status': 'running'})
        except Exception:
            pass  # Don't let socket errors crash the worker
