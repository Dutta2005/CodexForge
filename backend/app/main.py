from __future__ import annotations

import os
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Sequence

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    import psycopg
except ImportError:  # pragma: no cover - optional when running SQLite locally
    psycopg = None

try:
    from git import Repo
except ImportError:  # pragma: no cover - optional until clone jobs are enabled
    Repo = None

DEFAULT_SQLITE_PATH = Path('/data/codexforge.sqlite3')
DATABASE_URL = os.getenv('DB_URI') or os.getenv('DATABASE_URL') or str(DEFAULT_SQLITE_PATH)
CLIENT_ORIGIN = os.getenv('CLIENT_ORIGIN', 'http://localhost:3000')

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


def init_db() -> None:
    with connection() as conn:
        execute(
            conn,
            'create table if not exists repositories('
            'id text primary key, url text not null, name text not null, framework text not null, summary text not null)',
        )
        execute(
            conn,
            'create table if not exists tasks('
            'id text primary key, repo_id text not null, prompt text not null, status text not null, created_at real not null)',
        )


@app.on_event('startup')
def startup() -> None:
    init_db()


@app.get('/api/health')
def health() -> dict[str, str]:
    return {'status': 'ok', 'database': 'postgres' if is_postgres() else 'sqlite'}


@app.post('/api/auth/github/session')
def github_session() -> dict[str, object]:
    return {'user': {'login': 'octocat'}, 'token': 'mock-session-token'}


@app.get('/api/auth/github/callback')
def github_callback(code: str | None = None) -> dict[str, object]:
    return {'status': 'received', 'provider': 'github', 'hasCode': bool(code)}


@app.post('/api/repositories/import')
def import_repository(req: ImportRequest) -> dict[str, object]:
    init_db()
    name = req.url.rstrip('/').split('/')[-1] or 'repository'
    repo_id = f'repo_{int(time.time() * 1000)}'
    summary = 'Detected TypeScript/Python workspace with package manifests, API routes, UI components, and persistent storage.'

    with connection() as conn:
        execute(conn, 'insert into repositories values(?,?,?,?,?)', (repo_id, req.url, name, 'Next.js/FastAPI', summary))

    return {
        'id': repo_id,
        'name': name,
        'url': req.url,
        'framework': 'Next.js/FastAPI',
        'summary': summary,
        'languages': ['TypeScript', 'Python'],
        'dependencies': ['next', 'fastapi', 'gitpython', 'psycopg'],
    }


@app.get('/api/repositories')
def repositories() -> list[dict[str, str]]:
    init_db()
    with connection() as conn:
        rows = fetch_all(conn, 'select id,url,name,framework,summary from repositories order by name')
    return [{'id': row[0], 'url': row[1], 'name': row[2], 'framework': row[3], 'summary': row[4]} for row in rows]


@app.post('/api/tasks')
async def create_task(req: TaskRequest) -> dict[str, str]:
    task_id = f'task_{int(time.time() * 1000)}'
    with connection() as conn:
        execute(conn, 'insert into tasks values(?,?,?,?,?)', (task_id, req.repo_id, req.prompt, 'running', time.time()))

    for log in ['Searching...', 'Editing...', 'Running Tests...', 'Generating Commit...', 'Finished...']:
        await sio.emit('task:log', {'task_id': task_id, 'message': log})

    return {'id': task_id, 'status': 'finished', 'commitMessage': req.prompt}


@app.get('/api/architecture/{repo_id}')
def architecture(repo_id: str) -> dict[str, list[dict[str, str]]]:
    return {
        'nodes': [{'id': 'app', 'label': 'App Router'}, {'id': 'api', 'label': 'FastAPI'}],
        'edges': [{'source': 'app', 'target': 'api'}],
    }
