from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import sqlite3
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Sequence
from urllib.parse import urlparse

import httpx
import socketio
from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None

try:
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None

try:
    from git import Repo
except ImportError:  # pragma: no cover
    Repo = None

from app.worker import TaskWorker

DEFAULT_SQLITE_PATH = Path('/data/codexforge.sqlite3')

if load_dotenv is not None:
    load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / '.env')

DATABASE_URL = os.getenv('DB_URI') or os.getenv('DATABASE_URL') or str(DEFAULT_SQLITE_PATH)
CLIENT_ORIGIN = os.getenv('CLIENT_ORIGIN', 'http://localhost:3000').rstrip('/')
WORKSPACE_ROOT = Path(os.getenv('WORKSPACE_ROOT', '/data/repos'))
CODEX_API_KEY = os.getenv('CODEX_API_KEY')

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(name)s %(levelname)s %(message)s')
logger = logging.getLogger('codexforge')

app = FastAPI(title='CodexForge API')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[CLIENT_ORIGIN, 'http://localhost:3000', 'http://localhost:3001'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins=[CLIENT_ORIGIN, 'http://localhost:3000'])
socket_app = socketio.ASGIApp(sio, app)


class ImportRequest(BaseModel):
    url: str


class TaskRequest(BaseModel):
    repo_id: str
    prompt: str


_IS_POSTGRES = DATABASE_URL.startswith(('postgres://', 'postgresql://'))
def is_postgres() -> bool:
    return _IS_POSTGRES


_local = threading.local()

@contextmanager
def connection() -> Iterator[object]:
    if is_postgres():
        if psycopg is None:
            raise RuntimeError('psycopg is required when DB_URI/DATABASE_URL points to PostgreSQL')
        with psycopg.connect(DATABASE_URL) as conn:
            yield conn
        return

    sqlite_path = Path(DATABASE_URL)
    sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    
    if not hasattr(_local, "sqlite_conn"):
        # check_same_thread=False since we are using connection per thread, but 
        # sometimes asyncio to_thread might reuse thread. It's safe since sqlite handles it.
        _local.sqlite_conn = sqlite3.connect(sqlite_path, check_same_thread=False)
    
    try:
        yield _local.sqlite_conn
        _local.sqlite_conn.commit()
    except Exception:
        _local.sqlite_conn.rollback()
        raise


def execute(conn: object, sql: str, params: Sequence[object] = ()) -> None:
    statement = sql.replace('?', '%s') if is_postgres() else sql
    conn.execute(statement, params)  # type: ignore[attr-defined]


def fetch_all(conn: object, sql: str, params: Sequence[object] = ()) -> list[tuple]:
    statement = sql.replace('?', '%s') if is_postgres() else sql
    cursor = conn.execute(statement, params)  # type: ignore[attr-defined]
    return list(cursor.fetchall())


def fetch_one(conn: object, sql: str, params: Sequence[object] = ()) -> tuple | None:
    statement = sql.replace('?', '%s') if is_postgres() else sql
    cursor = conn.execute(statement, params)  # type: ignore[attr-defined]
    return cursor.fetchone()


def add_column_if_missing(conn: object, table: str, column: str, definition: str) -> None:
    try:
        if is_postgres():
            execute(conn, f'alter table {table} add column if not exists {column} {definition}')
        else:
            execute(conn, f'alter table {table} add column {column} {definition}')
    except Exception:
        rollback = getattr(conn, 'rollback', None)
        if rollback:
            rollback()


def init_db() -> None:
    WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)
    with connection() as conn:
        execute(conn, 'create table if not exists repositories(id text primary key, url text not null, name text not null, framework text not null, summary text not null)')
        add_column_if_missing(conn, 'repositories', 'languages', "text not null default '[]'")
        add_column_if_missing(conn, 'repositories', 'dependencies', "text not null default '[]'")
        add_column_if_missing(conn, 'repositories', 'local_path', "text not null default ''")
        add_column_if_missing(conn, 'repositories', 'imported_at', 'real not null default 0')
        add_column_if_missing(conn, 'repositories', 'github_token', "text not null default ''")
        execute(conn, 'create table if not exists tasks(id text primary key, repo_id text not null, prompt text not null, status text not null, created_at real not null)')
        add_column_if_missing(conn, 'tasks', 'plan', "text not null default '[]'")
        add_column_if_missing(conn, 'tasks', 'logs', "text not null default '[]'")
        add_column_if_missing(conn, 'tasks', 'files_changed', "text not null default '[]'")
        add_column_if_missing(conn, 'tasks', 'test_output', "text not null default ''")
        add_column_if_missing(conn, 'tasks', 'pr_url', "text not null default ''")
        execute(conn, 'create table if not exists users(github_login text primary key, github_token text not null, avatar_url text not null default \'\', updated_at real not null default 0)')


def repo_name_from_url(url: str) -> str:
    parsed = urlparse(url)
    name = Path(parsed.path).stem if parsed.path else Path(url).stem
    return name or f'repository-{int(time.time())}'


def detect_language(path: Path) -> str | None:
    return {
        '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript', '.prisma': 'Prisma',
        '.py': 'Python', '.go': 'Go', '.rs': 'Rust', '.java': 'Java', '.rb': 'Ruby', '.php': 'PHP',
        '.cs': 'C#', '.sql': 'SQL', '.css': 'CSS', '.html': 'HTML', '.md': 'Markdown'
    }.get(path.suffix)


def analyze_repository(local_path: Path) -> dict[str, object]:
    languages: set[str] = set()
    dependencies: set[str] = set()
    frameworks: set[str] = set()
    
    package_jsons = []
    requirements_txts = []
    pyproject_tomls = []

    for file_path in local_path.rglob('*'):
        if '.git' in file_path.parts or 'node_modules' in file_path.parts or 'venv' in file_path.parts or file_path.is_dir():
            continue
            
        language = detect_language(file_path)
        if language:
            languages.add(language)
            
        if file_path.name == 'package.json':
            package_jsons.append(file_path)
        elif file_path.name in ('requirements.txt', 'requirements.in'):
            requirements_txts.append(file_path)
        elif file_path.name == 'pyproject.toml':
            pyproject_tomls.append(file_path)

    for package_json in package_jsons:
        try:
            package = json.loads(package_json.read_text(errors='ignore'))
            for section in ('dependencies', 'devDependencies'):
                deps = package.get(section) or {}
                dependencies.update(deps.keys())
        except Exception:
            pass

    for requirements in requirements_txts:
        try:
            for line in requirements.read_text(errors='ignore').splitlines():
                line = line.strip()
                if line and not line.startswith('#'):
                    dep = line.split('==')[0].split('>=')[0].split('<=')[0].split('~=')[0].strip()
                    if dep:
                        dependencies.add(dep)
        except Exception:
            pass

    for pyproject in pyproject_tomls:
        try:
            dependencies.add('pyproject.toml')
            languages.add('Python')
        except Exception:
            pass

    if 'next' in dependencies:
        frameworks.add('Next.js')
    elif 'vite' in dependencies:
        frameworks.add('Vite')
    elif 'react' in dependencies:
        frameworks.add('React')
        
    if 'fastapi' in dependencies:
        frameworks.add('FastAPI')
    elif 'flask' in dependencies:
        frameworks.add('Flask')
    elif 'django' in dependencies:
        frameworks.add('Django')
        
    if 'express' in dependencies:
        frameworks.add('Express')
    elif 'fastify' in dependencies:
        frameworks.add('Fastify')
    elif 'hono' in dependencies:
        frameworks.add('Hono')
    elif 'nestjs' in dependencies or '@nestjs/core' in dependencies:
        frameworks.add('NestJS')

    framework = ' + '.join(sorted(frameworks)) if frameworks else 'Unknown'
    summary = f'Detected {framework} repository with {len(languages)} languages and {len(dependencies)} dependencies.'
    
    return {'framework': framework, 'languages': sorted(languages), 'dependencies': sorted(dependencies), 'summary': summary}


def repository_to_dict(row: tuple) -> dict[str, object]:
    return {
        'id': row[0], 'url': row[1], 'name': row[2], 'framework': row[3], 'summary': row[4],
        'languages': json.loads(row[5]), 'dependencies': json.loads(row[6]), 'localPath': row[7], 'importedAt': row[8],
    }


def task_to_dict(row: tuple) -> dict[str, object]:
    return {
        'id': row[0], 'repoId': row[1], 'title': row[2], 'status': row[3], 'plan': json.loads(row[4]),
        'logs': json.loads(row[5]), 'filesChanged': json.loads(row[6]), 'testOutput': row[7], 'createdAt': row[8],
        'prUrl': row[9] if len(row) > 9 else '',
    }


@app.on_event('startup')
async def startup() -> None:
    await asyncio.to_thread(init_db)
    if CODEX_API_KEY:
        worker = TaskWorker(
            sio=sio,
            db_helpers={'connection': connection, 'execute': execute, 'fetch_all': fetch_all},
            codex_api_key=CODEX_API_KEY,
        )
        await worker.start()
        logger.info('Background task worker started')
    else:
        logger.warning('CODEX_API_KEY not set — background task worker will NOT start')


@app.get('/')
def root() -> dict[str, str]:
    return {'name': 'CodexForge API', 'status': 'ok'}


@app.head('/')
def root_head() -> dict[str, str]:
    return {'status': 'ok'}


@app.get('/api/auth/github/login')
def github_login() -> RedirectResponse:
    client_id = os.getenv('GITHUB_CLIENT_ID')
    callback_url = os.getenv('GITHUB_OAUTH_CALLBACK_URL') or f'{CLIENT_ORIGIN}/api/auth/github/callback'
    if not client_id:
        raise HTTPException(status_code=500, detail='GITHUB_CLIENT_ID is not configured')
    url = f'https://github.com/login/oauth/authorize?client_id={client_id}&redirect_uri={callback_url}&scope=repo%20read:user%20user:email'
    return RedirectResponse(url)

@app.get('/api/auth/me')
def auth_me() -> dict[str, object] | None:
    with connection() as conn:
        row = fetch_one(conn, 'select github_login, avatar_url from users order by updated_at desc limit 1')
        if row:
            return {'login': row[0], 'avatar_url': row[1]}
    return None

@app.post('/api/auth/logout')
def auth_logout() -> dict[str, str]:
    with connection() as conn:
        execute(conn, 'delete from users')
    return {'status': 'ok'}


@app.get('/api/health')
def health() -> dict[str, object]:
    return {'status': 'ok', 'database': 'postgres' if is_postgres() else 'sqlite', 'workspaceRoot': str(WORKSPACE_ROOT), 'codexConfigured': bool(CODEX_API_KEY)}


@app.post('/api/auth/github/session')
def github_session() -> dict[str, object]:
    client_id = os.getenv('GITHUB_CLIENT_ID')
    return {'configured': bool(client_id), 'loginUrl': f'https://github.com/login/oauth/authorize?client_id={client_id}' if client_id else None}


def _process_github_callback(code: str) -> str:
    client_id = os.getenv('GITHUB_CLIENT_ID')
    client_secret = os.getenv('GITHUB_CLIENT_SECRET')
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail='GitHub OAuth environment variables are not configured')
    
    token_response = httpx.post(
        'https://github.com/login/oauth/access_token',
        json={'client_id': client_id, 'client_secret': client_secret, 'code': code},
        headers={'Accept': 'application/json'},
        timeout=15,
    )
    token_response.raise_for_status()
    access_token = token_response.json().get('access_token')
    if not access_token:
        raise HTTPException(status_code=400, detail='GitHub did not return an access token')
    
    user_response = httpx.get(
        'https://api.github.com/user',
        headers={'Authorization': f'Bearer {access_token}', 'Accept': 'application/vnd.github+json'},
        timeout=15,
    )
    user_response.raise_for_status()
    user_data = user_response.json()
    login = user_data.get('login', 'github-user')
    avatar_url = user_data.get('avatar_url', '')

    with connection() as conn:
        existing = fetch_one(conn, 'select github_login from users where github_login=?', (login,))
        if existing:
            execute(conn, 'update users set github_token=?, avatar_url=?, updated_at=? where github_login=?', (access_token, avatar_url, time.time(), login))
        else:
            execute(conn, 'insert into users(github_login, github_token, avatar_url, updated_at) values(?,?,?,?)', (login, access_token, avatar_url, time.time()))
    
    return login

@app.get('/api/auth/github/callback')
async def github_callback(code: str | None = None) -> RedirectResponse:
    if not code:
        raise HTTPException(status_code=400, detail='Missing GitHub OAuth code')
    login = await asyncio.to_thread(_process_github_callback, code)
    logger.info('Stored GitHub token for user %s', login)
    return RedirectResponse(f'{CLIENT_ORIGIN}/dashboard?github=connected&login={login}')


def _do_import_repository(req_url: str) -> dict[str, object]:
    if Repo is None:
        raise HTTPException(status_code=500, detail='GitPython is not installed')
    name = repo_name_from_url(req_url)
    repo_id = f'repo_{int(time.time() * 1000)}'
    local_path = WORKSPACE_ROOT / repo_id
    if local_path.exists():
        shutil.rmtree(local_path)
    try:
        Repo.clone_from(req_url, local_path, depth=1)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f'Clone failed: {exc}') from exc

    analysis = analyze_repository(local_path)
    with connection() as conn:
        execute(conn, 'insert into repositories(id,url,name,framework,summary,languages,dependencies,local_path,imported_at) values(?,?,?,?,?,?,?,?,?)', (repo_id, req_url, name, analysis['framework'], analysis['summary'], json.dumps(analysis['languages']), json.dumps(analysis['dependencies']), str(local_path), time.time()))
    return {'id': repo_id, 'name': name, 'url': req_url, **analysis, 'localPath': str(local_path), 'importedAt': time.time()}


@app.post('/api/repositories/import')
async def import_repository(req: ImportRequest) -> dict[str, object]:
    return await asyncio.to_thread(_do_import_repository, req.url)


def _get_repositories() -> list[dict[str, object]]:
    with connection() as conn:
        rows = fetch_all(conn, 'select id,url,name,framework,summary,languages,dependencies,local_path,imported_at from repositories order by imported_at desc')
    return [repository_to_dict(row) for row in rows]

@app.get('/api/repositories')
async def repositories() -> list[dict[str, object]]:
    return await asyncio.to_thread(_get_repositories)


def _get_dashboard() -> dict[str, object]:
    with connection() as conn:
        repo_count = fetch_all(conn, 'select count(*) from repositories')[0][0]
        task_count = fetch_all(conn, 'select count(*) from tasks')[0][0]
        recent_repositories = fetch_all(conn, 'select id,url,name,framework,summary,languages,dependencies,local_path,imported_at from repositories order by imported_at desc limit 5')
        recent_tasks = fetch_all(conn, 'select id,repo_id,prompt,status,plan,logs,files_changed,test_output,created_at,pr_url from tasks order by created_at desc limit 5')
    return {'stats': {'repositories': repo_count, 'tasks': task_count}, 'repositories': [repository_to_dict(row) for row in recent_repositories], 'tasks': [task_to_dict(row) for row in recent_tasks]}

@app.get('/api/dashboard')
async def dashboard() -> dict[str, object]:
    return await asyncio.to_thread(_get_dashboard)


def _do_create_task(req_repo_id: str, req_prompt: str, task_id: str, status: str, plan: list[str], logs: list[str]) -> None:
    with connection() as conn:
        execute(conn, 'insert into tasks(id,repo_id,prompt,status,plan,logs,files_changed,test_output,created_at,pr_url) values(?,?,?,?,?,?,?,?,?,?)', (task_id, req_repo_id, req_prompt, status, json.dumps(plan), json.dumps(logs), json.dumps([]), '', time.time(), ''))

@app.post('/api/tasks')
async def create_task(req: TaskRequest) -> dict[str, object]:
    task_id = f'task_{int(time.time() * 1000)}'
    plan = ['Fetch issue context from GitHub', 'Analyze repository structure', 'Generate code fix with AI', 'Create branch and commit changes', 'Open pull request']
    logs = []
    if not CODEX_API_KEY:
        logs.append('CODEX_API_KEY is not configured; task recorded but autonomous execution was skipped.')
        status = 'failed'
    else:
        logs.append('Task queued — the background worker will pick this up shortly.')
        status = 'queued'
    
    await asyncio.to_thread(_do_create_task, req.repo_id, req.prompt, task_id, status, plan, logs)
    
    for log in logs:
        await sio.emit('task:log', {'task_id': task_id, 'message': log})
    return {'id': task_id, 'repoId': req.repo_id, 'title': req.prompt, 'status': status, 'plan': plan, 'logs': logs, 'filesChanged': [], 'prUrl': '', 'createdAt': time.time()}


def _get_tasks() -> list[dict[str, object]]:
    with connection() as conn:
        rows = fetch_all(conn, 'select id,repo_id,prompt,status,plan,logs,files_changed,test_output,created_at,pr_url from tasks order by created_at desc')
    return [task_to_dict(row) for row in rows]

@app.get('/api/tasks')
async def tasks() -> list[dict[str, object]]:
    return await asyncio.to_thread(_get_tasks)


def _parse_owner_repo(url: str) -> tuple[str, str]:
    """Extract (owner, repo_name) from a GitHub URL."""
    parsed = urlparse(url)
    parts = [p for p in parsed.path.strip('/').split('/') if p]
    if len(parts) >= 2:
        repo_name = parts[1].removesuffix('.git')
        return parts[0], repo_name
    raise ValueError(f'Cannot parse owner/repo from URL: {url}')


def _get_architecture_from_github(url: str, repo_name: str) -> dict[str, object]:
    """Fetch repo file tree from GitHub API — no local clone needed."""
    owner, name = _parse_owner_repo(url)

    # Get a GitHub token from the users table (if any) for higher rate limits
    github_token = None
    try:
        with connection() as conn:
            row = fetch_one(conn, 'select github_token from users order by updated_at desc limit 1')
            if row and row[0]:
                github_token = row[0]
    except Exception:
        pass

    headers = {'Accept': 'application/vnd.github+json'}
    if github_token:
        headers['Authorization'] = f'Bearer {github_token}'

    resp = httpx.get(
        f'https://api.github.com/repos/{owner}/{name}/git/trees/HEAD?recursive=1',
        headers=headers,
        timeout=15,
    )
    resp.raise_for_status()
    tree_data = resp.json()

    nodes = [{'id': 'root', 'label': repo_name, 'type': 'folder'}]
    edges = []

    # Build a set of directories and collect top-level entries
    top_level_entries: list[dict[str, str]] = []
    seen_dirs: set[str] = set()

    for item in tree_data.get('tree', []):
        path_str = item.get('path', '')
        item_type = item.get('type', '')  # 'blob' or 'tree'

        # Skip hidden files/dirs and nested entries for the top-level view
        if '/' not in path_str and not path_str.startswith('.'):
            entry_type = 'folder' if item_type == 'tree' else 'file'
            top_level_entries.append({'name': path_str, 'type': entry_type})
        elif '/' in path_str:
            top_dir = path_str.split('/')[0]
            if not top_dir.startswith('.'):
                seen_dirs.add(top_dir)

    # Merge: ensure top-level dirs from nested paths are included
    existing_names = {e['name'] for e in top_level_entries}
    for d in sorted(seen_dirs):
        if d not in existing_names:
            top_level_entries.append({'name': d, 'type': 'folder'})

    # Sort: folders first, then files, alphabetically
    top_level_entries.sort(key=lambda e: (0 if e['type'] == 'folder' else 1, e['name']))

    for index, entry in enumerate(top_level_entries[:30], start=1):
        node_id = f'node_{index}'
        nodes.append({'id': node_id, 'label': entry['name'], 'type': entry['type']})
        edges.append({'id': f'edge_{index}', 'source': 'root', 'target': node_id})

    return {'nodes': nodes, 'edges': edges}


def _get_architecture(repo_id: str) -> dict[str, object]:
    with connection() as conn:
        rows = fetch_all(conn, 'select url, name, local_path from repositories where id=?', (repo_id,))
    if not rows:
        raise HTTPException(status_code=404, detail='Repository not found')

    url = rows[0][0]
    repo_name = rows[0][1]
    local_path = rows[0][2]

    # Try GitHub API first (works on ephemeral hosts like Render)
    try:
        return _get_architecture_from_github(url, repo_name)
    except Exception as exc:
        logger.warning('GitHub API tree fetch failed for %s: %s — falling back to local', repo_id, exc)

    # Fallback to local filesystem if available
    root = Path(local_path)
    if not root.exists():
        raise HTTPException(status_code=404, detail='Repository files not found. The cloned data may have been cleared on the server. Try re-importing the repository.')

    nodes = [{'id': 'root', 'label': root.name, 'type': 'folder'}]
    edges = []
    for index, path in enumerate([p for p in root.iterdir() if p.name != '.git'][:20], start=1):
        node_id = f'node_{index}'
        nodes.append({'id': node_id, 'label': path.name, 'type': 'folder' if path.is_dir() else 'file'})
        edges.append({'id': f'edge_{index}', 'source': 'root', 'target': node_id})
    return {'nodes': nodes, 'edges': edges}


@app.get('/api/architecture/{repo_id}')
async def architecture(repo_id: str) -> dict[str, object]:
    return await asyncio.to_thread(_get_architecture, repo_id)
