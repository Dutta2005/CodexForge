from __future__ import annotations
import sqlite3, time
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel
import socketio
try:
    from git import Repo
except ImportError:  # pragma: no cover
    Repo = None
DB = Path('/data/codexforge.sqlite3')
app = FastAPI(title='CodexForge API')
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)
class ImportRequest(BaseModel): url: str
class TaskRequest(BaseModel): repo_id: str; prompt: str
def init_db():
    DB.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB) as cx:
        cx.execute('create table if not exists repositories(id text primary key, url text, name text, framework text, summary text)')
        cx.execute('create table if not exists tasks(id text primary key, repo_id text, prompt text, status text, created_at real)')
@app.on_event('startup')
def startup(): init_db()
@app.post('/api/auth/github/session')
def github_session(): return {'user': {'login': 'octocat'}, 'token': 'mock-session-token'}
@app.post('/api/repositories/import')
def import_repository(req: ImportRequest):
    init_db(); name=req.url.rstrip('/').split('/')[-1] or 'repository'; rid=f'repo_{int(time.time()*1000)}'
    summary='Detected TypeScript/Python workspace with package manifests, API routes, UI components, and SQLite persistence.'
    with sqlite3.connect(DB) as cx: cx.execute('insert into repositories values(?,?,?,?,?)',(rid,req.url,name,'Next.js/FastAPI',summary))
    return {'id':rid,'name':name,'url':req.url,'framework':'Next.js/FastAPI','summary':summary,'languages':['TypeScript','Python'],'dependencies':['next','fastapi','gitpython']}
@app.get('/api/repositories')
def repositories():
    init_db();
    with sqlite3.connect(DB) as cx: rows=cx.execute('select id,url,name,framework,summary from repositories').fetchall()
    return [{'id':r[0],'url':r[1],'name':r[2],'framework':r[3],'summary':r[4]} for r in rows]
@app.post('/api/tasks')
async def create_task(req: TaskRequest):
    tid=f'task_{int(time.time()*1000)}'
    with sqlite3.connect(DB) as cx: cx.execute('insert into tasks values(?,?,?,?,?)',(tid,req.repo_id,req.prompt,'running',time.time()))
    for log in ['Searching...','Editing...','Running Tests...','Generating Commit...','Finished...']:
        await sio.emit('task:log', {'task_id': tid, 'message': log})
    return {'id':tid,'status':'finished','commitMessage':f'{req.prompt}'}
@app.get('/api/architecture/{repo_id}')
def architecture(repo_id: str): return {'nodes':[{'id':'app','label':'App Router'},{'id':'api','label':'FastAPI'}],'edges':[{'source':'app','target':'api'}]}
