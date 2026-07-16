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


## GitHub OAuth URL settings

There are two `.env.example` files because the Next.js frontend and FastAPI backend run as separate services. Use the root `.env.example` for local frontend/Vercel values and `backend/.env.example` for backend host values.

When creating a GitHub OAuth App, use these URLs:

### Local development

- **Homepage URL**: `http://localhost:3000`
- **Authorization callback URL**: `http://localhost:8000/api/auth/github/callback`

### Production

- **Homepage URL**: your Vercel frontend URL, for example `https://codexforge.vercel.app`
- **Authorization callback URL**: your deployed backend URL plus `/api/auth/github/callback`, for example `https://codexforge-backend.onrender.com/api/auth/github/callback`

Set the same production callback URL as `GITHUB_OAUTH_CALLBACK_URL` on the backend host. Set `CLIENT_ORIGIN` to the Vercel frontend URL so CORS and Socket.IO accept browser requests.

## Deploying the backend for free

The frontend is configured for Vercel, but the FastAPI backend needs its own host. The repo includes `render.yaml` for Render's free web-service tier.


### Manual Render deploy settings

If Render Blueprints are unavailable on your plan, create a regular **New > Web Service** and use these settings:

- **Source**: `https://github.com/Dutta2005/CodexForge`
- **Branch**: `main`
- **Runtime / Language**: Docker
- **Root directory**: `backend`
- **Dockerfile path**: `Dockerfile` because the root directory is already `backend`
- **Health check path**: `/api/health`
- **Instance type**: Free
- **Environment variables**: add `DB_URI`, `CLIENT_ORIGIN`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_OAUTH_CALLBACK_URL`, `CODEX_API_KEY`, and `WORKSPACE_ROOT` in Render's Environment tab.

After Render creates the service, update `GITHUB_OAUTH_CALLBACK_URL` to `https://YOUR_RENDER_SERVICE.onrender.com/api/auth/github/callback` and update the GitHub OAuth App callback URL to the same value.

### Render backend steps

1. Create a Render account and choose **New > Blueprint**.
2. Connect this GitHub repository and select `render.yaml`.
3. Add these environment variables in Render:
   - `DB_URI`: your hosted PostgreSQL connection string, such as a Neon pooled URL.
   - `CLIENT_ORIGIN`: your deployed Vercel frontend URL, for example `https://your-app.vercel.app`.
   - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`: from a GitHub OAuth App.
   - `CODEX_API_KEY`: from your AI/Codex provider dashboard.
4. Deploy the service and copy the Render URL, for example `https://codexforge-backend.onrender.com`.
5. In Vercel, set:
   - `NEXT_PUBLIC_API_URL=https://codexforge-backend.onrender.com`
   - `NEXT_PUBLIC_SOCKET_URL=https://codexforge-backend.onrender.com`
6. Redeploy the Vercel frontend.

Never commit real database URLs or API secrets. Keep those values in the hosting provider's environment variable UI.
