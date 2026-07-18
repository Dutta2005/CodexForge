# CodexForge

> **Your Autonomous AI Engineering Workspace** — Import any GitHub repository and let AI understand, modify, test, and ship code for you.

🔗 **Live Demo:** [codexforge-raj.vercel.app](https://codexforge-raj.vercel.app)
🔗 **Backend API:** [codexforge.onrender.com](https://codexforge.onrender.com)

---

## What is CodexForge?

CodexForge is a full-stack AI engineering workspace that bridges the gap between your codebase and autonomous AI-powered development. Point it at any GitHub repository, describe the changes you want, and watch it analyze the architecture, generate code fixes, create branches, and open pull requests — all autonomously.

## Tech Stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion, Zustand |
| **Backend** | FastAPI, Python, GitPython, Socket.IO, OpenAI API |
| **Database** | PostgreSQL (Neon) |
| **UI Components** | shadcn/ui-style primitives, Lucide Icons, React Flow, Monaco Editor |
| **Deployment** | Vercel (frontend), Render (backend) |

## Features

### 🔐 GitHub OAuth Authentication
- One-click "Continue with GitHub" login via OAuth.
- Persistent session state managed with Zustand + `localStorage`.
- Profile dashboard with your GitHub avatar, username, and live contribution graph.

### 📦 Smart Repository Import
- Clone any public or private GitHub repository via URL.
- **Monorepo-aware analysis** — recursively discovers every `package.json`, `requirements.txt`, `requirements.in`, and `pyproject.toml` across the entire project (skipping `node_modules`, `venv`, `.git`).
- Multi-framework detection: correctly identifies combinations like **Next.js + FastAPI**, **React + Express + Hono**, **Vite + Django**, and more.
- Auto-detects 15+ languages including TypeScript, Python, Go, Rust, Java, Ruby, PHP, C#, Prisma, and more.

### 🤖 AI Task Runner
- Describe any feature, bugfix, or refactor in natural language.
- Autonomous pipeline: fetches GitHub issue context → analyzes the file tree → gathers key source files → generates code changes using advanced LLMs (GPT-5).
- **Real-time streaming** of execution logs via Socket.IO directly into a styled terminal interface.
- Visual execution plan stepper showing each phase of the autonomous workflow.

### 🔀 End-to-End GitHub Integration
- Automatically creates feature branches and commits AI-generated changes.
- Opens pull requests with generated titles and descriptions.
- **Smart permission detection** — if the GitHub App isn't installed on the target repository, the UI automatically opens the GitHub App installation page.

### 🏗️ Architecture Explorer
- Interactive React Flow graph visualizing the project file structure.
- Glassmorphic node styling with zoom, pan, and drag support.

### 📊 Dashboard
- At-a-glance metrics: total repositories, total tasks.
- Recent repositories and task history.
- Animated loading skeletons for a polished data-loading experience.

### ⚙️ Settings & History
- GitHub App configuration panel.
- AI provider and theme preferences.
- Full task history with timeline view.

## Repository Structure

```
CodexForge/
├── app/                        # Next.js App Router pages
│   ├── page.tsx                # Landing page
│   ├── layout.tsx              # Root layout (Inter + JetBrains Mono fonts)
│   ├── globals.css             # Design tokens & custom scrollbar styles
│   ├── profile/                # Auth + profile dashboard (login/profile toggle)
│   ├── dashboard/              # Stats, recent repos, recent tasks
│   ├── repositories/           # Import & browse repositories
│   ├── tasks/                  # AI task runner + diff viewer
│   ├── architecture/           # React Flow graph explorer
│   ├── history/                # Task history timeline
│   └── settings/               # Configuration panels
├── components/
│   ├── ui/                     # Button, Card, Badge, Input, Skeleton
│   └── workspace/              # Shell layout with responsive sidebar
├── lib/
│   ├── api.ts                  # Typed API client for all backend endpoints
│   ├── store.ts                # Zustand auth store (persisted to localStorage)
│   └── utils.ts                # Utility helpers (cn)
├── backend/
│   └── app/
│       ├── main.py             # FastAPI app, Socket.IO, all API routes
│       └── worker.py           # Async background task worker (OpenAI + GitHub)
├── tailwind.config.ts          # Custom emerald/teal forge theme
├── render.yaml                 # Render deployment blueprint
├── docker-compose.yml          # Local Docker setup
└── vitest.config.ts            # Test configuration
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- A PostgreSQL database (e.g., [Neon](https://neon.tech) free tier)
- A [GitHub OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) or [GitHub App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps)
- An OpenAI API key

### Frontend

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your values
npm run dev
```

### Backend

```bash
cd backend
python -m venv venv
# On macOS/Linux:
source venv/bin/activate
# On Windows:
.\venv\Scripts\activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env with your database URL, GitHub OAuth, and OpenAI key
uvicorn app.main:socket_app --reload --port 8000
```

### Docker

```bash
docker compose up --build
```

## Environment Variables

### Frontend (`.env.local` or Vercel)

| Variable | Description | Example |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:8000` |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO backend URL | `http://localhost:8000` |
| `NEXT_PUBLIC_APP_URL` | Frontend app URL | `http://localhost:3000` |
| `NEXT_PUBLIC_GITHUB_APP_NAME` | (Optional) GitHub App slug for install redirects | `codexforge-app` |

### Backend (`backend/.env` or Render)

| Variable | Description | Example |
| --- | --- | --- |
| `DB_URI` | PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `CLIENT_ORIGIN` | Frontend URL for CORS/Socket.IO | `http://localhost:3000` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID | `Iv1.abc123...` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret | `abc123...` |
| `GITHUB_OAUTH_CALLBACK_URL` | OAuth callback URL | `http://localhost:8000/api/auth/github/callback` |
| `CODEX_API_KEY` | OpenAI API key | `sk-...` |
| `WORKSPACE_ROOT` | Local path for cloned repos | `/data/repos` |

## API Reference

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check (database type, codex status) |
| `GET` | `/api/auth/github/login` | Initiates GitHub OAuth flow |
| `GET` | `/api/auth/github/callback` | Handles OAuth callback, stores token |
| `GET` | `/api/auth/me` | Returns the currently authenticated user |
| `POST` | `/api/auth/logout` | Clears the authenticated session |
| `POST` | `/api/auth/github/session` | Returns GitHub OAuth configuration status |
| `GET` | `/api/dashboard` | Aggregate stats, recent repos and tasks |
| `GET` | `/api/repositories` | List all imported repositories |
| `POST` | `/api/repositories/import` | Clone and analyze a GitHub repository |
| `GET` | `/api/tasks` | List all tasks |
| `POST` | `/api/tasks` | Create and queue an AI task |
| `GET` | `/api/architecture/{repo_id}` | Get file structure graph for a repository |

**Socket.IO Events:** `task:log` — streams real-time execution logs from the background worker to connected clients.

## GitHub OAuth Setup

When registering your GitHub OAuth App, use these URLs:

**Local Development:**
- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:8000/api/auth/github/callback`

**Production:**
- Homepage URL: `https://codexforge-raj.vercel.app`
- Authorization callback URL: `https://codexforge.onrender.com/api/auth/github/callback`

> **Important:** If you're using a GitHub App (not just an OAuth App) and want the AI to create branches and pull requests, make sure the App is **installed** on your target repository with **Contents**, **Pull Requests**, and **Workflows** permissions set to Read & Write.

## Deployment

### Frontend → Vercel

The frontend is deployed to Vercel. Set these environment variables in the Vercel dashboard:

```
NEXT_PUBLIC_API_URL=https://codexforge.onrender.com
NEXT_PUBLIC_SOCKET_URL=https://codexforge.onrender.com
NEXT_PUBLIC_APP_URL=https://codexforge-raj.vercel.app
```

### Backend → Render

The repo includes a `render.yaml` blueprint. To deploy manually:

1. Create a **New > Web Service** on [Render](https://render.com).
2. Connect the GitHub repository.
3. Set **Root Directory** to `backend`, **Runtime** to Docker.
4. Add environment variables: `DB_URI`, `CLIENT_ORIGIN`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_OAUTH_CALLBACK_URL`, `CODEX_API_KEY`, `WORKSPACE_ROOT`.
5. Set **Health Check Path** to `/api/health`.
6. Deploy.

After deployment, update `GITHUB_OAUTH_CALLBACK_URL` to `https://codexforge.onrender.com/api/auth/github/callback` and update the callback URL in your GitHub OAuth App settings to match.

> **Note:** Never commit real database URLs or API secrets. Keep those values in the hosting provider's environment variable UI.

## No Mock-Data Policy

All primary product flows use real backend APIs:

- Repository import clones a real Git repository with GitPython and persists analysis in PostgreSQL.
- Dashboard, history, architecture, repositories, and tasks all read from FastAPI endpoints.
- Task creation records backend state and refuses to claim autonomous execution when `CODEX_API_KEY` is missing.

Remaining static text in the UI is explanatory copy only, not fake persisted product state.

## License

This project is built for the hackathon and is open source.
