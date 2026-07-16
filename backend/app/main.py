from __future__ import annotations

import json
import os
import shutil
import sqlite3
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
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None

try:
    from git import Repo
except ImportError:  # pragma: no cover
    Repo = None

DEFAULT_SQLITE_PATH = Path('/data/codexforge.sqlite3')
DATABASE_URL = os.getenv('DB_URI') or os.getenv('DATABASE_URL') or str(DEFAULT_SQLITE_PATH)
CLIENT_ORIGIN = os.getenv('CLIENT_ORIGIN', 'http://localhost:3000').rstrip('/')
WORKSPACE_ROOT = Path(os.getenv('WORKSPACE_ROOT', '/data/repos'))
CODEX_API_KEY = os.getenv('CODEX_API_KEY')

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


def is_postgres() -> bool:
    return DATABASE_URL.startswith(('postgres://', 'postgresql://'))


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
    with sqlite3.connect(sqlite_path) as conn:
        yield conn


def execute(conn: object, sql: str, params: Sequence[object] = ()) -> None:
    statement = sql.replace('?', '%s') if is_postgres() else sql
    conn.execute(statement, params)  # type: ignore[attr-defined]


def fetch_all(conn: object, sql: str, params: Sequence[object] = ()) -> list[tuple]:
    statement = sql.replace('?', '%s') if is_postgres() else sql
    cursor = conn.execute(statement, params)  # type: ignore[attr-defined]
    return list(cursor.fetchall())


def add_column_if_missing(conn: object, table: str, column: str, definition: str) -> None:
    try:
        execute(conn, f'alter table {table} add column {column} {definition}')
    except Exception:
        # PostgreSQL aborts the current transaction after any SQL error, even if Python catches it.
        # Roll back so later migration statements can continue safely.
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
        execute(conn, 'create table if not exists tasks(id text primary key, repo_id text not null, prompt text not null, status text not null, created_at real not null)')
        add_column_if_missing(conn, 'tasks', 'plan', "text not null default '[]'")
        add_column_if_missing(conn, 'tasks', 'logs', "text not null default '[]'")
        add_column_if_missing(conn, 'tasks', 'files_changed', "text not null default '[]'")
        add_column_if_missing(conn, 'tasks', 'test_output', "text not null default ''")


def repo_name_from_url(url: str) -> str:
    parsed = urlparse(url)
    name = Path(parsed.path).stem if parsed.path else Path(url).stem
    return name or f'repository-{int(time.time())}'


def detect_language(path: Path) -> str | None:
    return {
        '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript',
        '.py': 'Python', '.go': 'Go', '.rs': 'Rust', '.java': 'Java', '.rb': 'Ruby', '.php': 'PHP',
        '.cs': 'C#', '.sql': 'SQL', '.css': 'CSS', '.html': 'HTML', '.md': 'Markdown'
    }.get(path.suffix)


def analyze_repository(local_path: Path) -> dict[str, object]:
    languages: set[str] = set()
    dependencies: set[str] = set()
    framework = 'Unknown'
    package_json = local_path / 'package.json'
    requirements = local_path / 'requirements.txt'
    pyproject = local_path / 'pyproject.toml'

    for file_path in local_path.rglob('*'):
        if '.git' in file_path.parts or file_path.is_dir():
            continue
        language = detect_language(file_path)
        if language:
            languages.add(language)

    if package_json.exists():
        package = json.loads(package_json.read_text(errors='ignore'))
        for section in ('dependencies', 'devDependencies'):
            dependencies.update((package.get(section) or {}).keys())
        if 'next' in dependencies:
            framework = 'Next.js'
        elif 'vite' in dependencies:
            framework = 'Vite'
        elif 'react' in dependencies:
            framework = 'React'

    if requirements.exists():
        for line in requirements.read_text(errors='ignore').splitlines():
            line = line.strip()
            if line and not line.startswith('#'):
                dependencies.add(line.split('==')[0].split('>=')[0])
        if 'fastapi' in dependencies:
            framework = f'{framework} + FastAPI' if framework != 'Unknown' else 'FastAPI'

    if pyproject.exists():
        dependencies.add('pyproject.toml')
        languages.add('Python')

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
    }


@app.on_event('startup')
def startup() -> None:
    init_db()



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


@app.get('/api/health')
def health() -> dict[str, object]:
    return {'status': 'ok', 'database': 'postgres' if is_postgres() else 'sqlite', 'workspaceRoot': str(WORKSPACE_ROOT), 'codexConfigured': bool(CODEX_API_KEY)}


@app.post('/api/auth/github/session')
def github_session() -> dict[str, object]:
    client_id = os.getenv('GITHUB_CLIENT_ID')
    return {'configured': bool(client_id), 'loginUrl': f'https://github.com/login/oauth/authorize?client_id={client_id}' if client_id else None}


@app.get('/api/auth/github/callback')
def github_callback(code: str | None = None) -> RedirectResponse:
    if not code:
        raise HTTPException(status_code=400, detail='Missing GitHub OAuth code')
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
    login = user_response.json().get('login', 'github-user')
    return RedirectResponse(f'{CLIENT_ORIGIN}/dashboard?github=connected&login={login}')


@app.post('/api/repositories/import')
def import_repository(req: ImportRequest) -> dict[str, object]:
    if Repo is None:
        raise HTTPException(status_code=500, detail='GitPython is not installed')
    init_db()
    name = repo_name_from_url(req.url)
    repo_id = f'repo_{int(time.time() * 1000)}'
    local_path = WORKSPACE_ROOT / repo_id
    if local_path.exists():
        shutil.rmtree(local_path)
    try:
        Repo.clone_from(req.url, local_path, depth=1)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f'Clone failed: {exc}') from exc

    analysis = analyze_repository(local_path)
    with connection() as conn:
        execute(conn, 'insert into repositories(id,url,name,framework,summary,languages,dependencies,local_path,imported_at) values(?,?,?,?,?,?,?,?,?)', (repo_id, req.url, name, analysis['framework'], analysis['summary'], json.dumps(analysis['languages']), json.dumps(analysis['dependencies']), str(local_path), time.time()))
    return {'id': repo_id, 'name': name, 'url': req.url, **analysis, 'localPath': str(local_path), 'importedAt': time.time()}


@app.get('/api/repositories')
def repositories() -> list[dict[str, object]]:
    init_db()
    with connection() as conn:
        rows = fetch_all(conn, 'select id,url,name,framework,summary,languages,dependencies,local_path,imported_at from repositories order by imported_at desc')
    return [repository_to_dict(row) for row in rows]


@app.get('/api/dashboard')
def dashboard() -> dict[str, object]:
    init_db()
    with connection() as conn:
        repo_count = fetch_all(conn, 'select count(*) from repositories')[0][0]
        task_count = fetch_all(conn, 'select count(*) from tasks')[0][0]
        recent_repositories = fetch_all(conn, 'select id,url,name,framework,summary,languages,dependencies,local_path,imported_at from repositories order by imported_at desc limit 5')
        recent_tasks = fetch_all(conn, 'select id,repo_id,prompt,status,plan,logs,files_changed,test_output,created_at from tasks order by created_at desc limit 5')
    return {'stats': {'repositories': repo_count, 'tasks': task_count}, 'repositories': [repository_to_dict(row) for row in recent_repositories], 'tasks': [task_to_dict(row) for row in recent_tasks]}


@app.post('/api/tasks')
async def create_task(req: TaskRequest) -> dict[str, object]:
    init_db()
    task_id = f'task_{int(time.time() * 1000)}'
    plan = ['Inspect repository metadata', 'Search relevant files', 'Prepare execution notes', 'Report required manual/Codex action']
    logs = []
    if not CODEX_API_KEY:
        logs.append('CODEX_API_KEY is not configured; task recorded but autonomous Codex execution was skipped.')
        status = 'failed'
    else:
        logs.append('CODEX_API_KEY configured; queued for Codex execution worker integration.')
        status = 'queued'
    with connection() as conn:
        execute(conn, 'insert into tasks(id,repo_id,prompt,status,plan,logs,files_changed,test_output,created_at) values(?,?,?,?,?,?,?,?,?)', (task_id, req.repo_id, req.prompt, status, json.dumps(plan), json.dumps(logs), json.dumps([]), '', time.time()))
    for log in logs:
        await sio.emit('task:log', {'task_id': task_id, 'message': log})
    return {'id': task_id, 'repoId': req.repo_id, 'title': req.prompt, 'status': status, 'plan': plan, 'logs': logs, 'filesChanged': [], 'createdAt': time.time()}


@app.get('/api/tasks')
def tasks() -> list[dict[str, object]]:
    init_db()
    with connection() as conn:
        rows = fetch_all(conn, 'select id,repo_id,prompt,status,plan,logs,files_changed,test_output,created_at from tasks order by created_at desc')
    return [task_to_dict(row) for row in rows]


@app.get('/api/architecture/{repo_id}')
def architecture(repo_id: str) -> dict[str, object]:
    init_db()
    with connection() as conn:
        rows = fetch_all(conn, 'select local_path from repositories where id=?', (repo_id,))
    if not rows:
        raise HTTPException(status_code=404, detail='Repository not found')
    root = Path(rows[0][0])
    nodes = [{'id': 'root', 'label': root.name, 'type': 'folder'}]
    edges = []
    for index, path in enumerate([p for p in root.iterdir() if p.name != '.git'][:20], start=1):
        node_id = f'node_{index}'
        nodes.append({'id': node_id, 'label': path.name, 'type': 'folder' if path.is_dir() else 'file'})
        edges.append({'id': f'edge_{index}', 'source': 'root', 'target': node_id})
    return {'nodes': nodes, 'edges': edges}
