# CodexForge

CodexForge is a production-oriented AI Engineering Workspace for importing GitHub repositories and using Codex Cloud-style automation to understand, modify, test, and improve codebases.

## Stack

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, shadcn-style primitives, Framer Motion-ready UI
- FastAPI, Python, GitPython, Socket.IO, SQLite
- React Flow-ready architecture model, Monaco diff viewer, xterm.js-ready execution surface

## Features

1. **Authentication**: GitHub OAuth entry point and session persistence surface.
2. **Dashboard**: imported repositories, recent runs, task history, and statistics.
3. **Repository import**: clone/analyze endpoint plus UI for package, framework, language, dependency, and architecture detection.
4. **Architecture view**: interactive dependency graph model with folder, route, component, API, and database layers.
5. **AI task runner**: issue prompt, editable plan, execution pipeline, streamed logs, modified files, tests, retries, and commit-message generation.
6. **Live execution**: Socket.IO events for `Searching`, `Editing`, `Running Tests`, `Generating Commit`, and `Finished`.
7. **Diff viewer**: Monaco-powered before/after diff component with accept/reject actions.
8. **Testing**: result cards, coverage metadata, and retry-oriented task modeling.
9. **Pull requests**: generated title, body, summary, and changed file metadata.
10. **History**: timeline-ready runs with rollback snapshot affordances.
11. **Settings**: GitHub, AI provider, theme, and preferences panels.

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Backend:

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
npm run backend:dev
```

Docker:

```bash
docker compose up --build
```

## API

- `POST /api/auth/github/session` creates a mock GitHub session payload.
- `POST /api/repositories/import` imports and analyzes a repository.
- `GET /api/repositories` lists imported repositories.
- `GET /api/architecture/{repo_id}` returns graph nodes and edges.
- `POST /api/tasks` creates a Codex task and streams Socket.IO progress.

## Repository layout

- `app/` Next.js routes and pages.
- `components/` reusable UI and workspace shell components.
- `lib/` typed API abstraction and mock data.
- `types/` domain models.
- `backend/` FastAPI application, database schema initialization, and Socket.IO server.
- `sample-repository/` local fixture for import and analysis tests.
- `__tests__/` unit tests for critical domain fixtures.
