# WorkMesh AI

**WorkMesh AI** is a multi-tenant enterprise AI productivity platform that unifies company knowledge search (RAG), LangGraph multi-agent orchestration, human-in-the-loop MCP email drafting, grounded PDF/DOCX report generation, and immutable security audit logging in a single workspace.

---

## Architecture Overview

```text
┌─────────────────────────┐      HTTP /api/*       ┌──────────────────────────────┐
│   Frontend (React 19)   │ ─────────────────────► │   Backend (Express + TS)     │
│   Vite + Tailwind CSS   │                        │   JWT Auth · RBAC · Prisma   │
└─────────────────────────┘                        └──────────────┬───────────────┘
                                                                  │ X-Internal-Key
                                                                  ▼
┌─────────────────────────┐      S3 / pgvector     ┌──────────────────────────────┐
│  Neon PostgreSQL + S3   │ ◄────────────────────► │  AI Service (FastAPI + Py)   │
│  pgvector (768-dim)     │                        │  LangGraph · Gemini · MCP    │
└─────────────────────────┘                        └──────────────────────────────┘
```

### Tech Stack
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Vitest, Playwright
- **Backend API:** Node.js, Express 5, TypeScript, Prisma ORM v7, Zod, Helmet, Rate Limiter, Vitest + Supertest
- **AI Service:** Python 3.11+, FastAPI, LangGraph (`StateGraph`), Google Gemini (`gemini-embedding-2-exp-03-07`, `gemini-2.5-flash` / `gemini-3.8-flash`), SQLAlchemy + `pgvector`, `python-docx`, `pypdf`, Ruff, Pytest
- **Infrastructure:** Neon PostgreSQL (`pgvector`), Neon S3-Compatible Object Storage, Multi-stage Dockerfiles + Docker Compose

---

## Key Features

- **Multi-Tenant Auth & RBAC (`EMPLOYEE`, `MANAGER`, `ADMIN`, `SUPER_ADMIN`):** Strict JWT `companyId` isolation enforced on every database query, vector search, S3 key, and audit log.
- **Document Hub:** Drag-and-drop PDF/DOCX/TXT ingestion into private S3 storage with pgvector chunking, retry endpoint, and real-time status polling.
- **Grounded RAG Knowledge Assistant:** Semantic vector search with inline chunk citations, interactive Source Drawer, persistent PostgreSQL conversation threads, and multi-session sidebar.
- **LangGraph Multi-Agent Supervisor:** Intent routing between `knowledge_agent` (company RAG) and `office_agent` (executive drafting) with cycle guardrails (`MAX_SUPERVISOR_ITERATIONS = 3`).
- **MCP Email Tools & Human-in-the-Loop Approval:** Office Agent email drafts halt at `human_approval_node` with a UUID4 `approval_token` persisted in PostgreSQL; users review, approve, or reject inline via `EmailDraftPanel`.
- **Grounded Report Generation (`/reports`):** Synthesizes company documents into downloadable `.pdf` and `.docx` reports stored privately in S3 and delivered via short-lived presigned URLs.
- **Production Hardening & Audit Trail:** `X-Request-Id` correlation, strict `CORS_ORIGINS` allowlist, `1mb` JSON payload limit, `GET /api/v1/health/ready` readiness probe, graceful `SIGTERM`/`SIGINT` shutdown, and Admin Audit Logs viewer.

---

## Quickstart

### Option A — Full-Stack Docker Compose

```bash
cp .env.docker.example .env
# Add your GEMINI_API_KEY and storage credentials in .env
docker compose up --build -d
```

- **Frontend:** `http://localhost:3000`
- **Backend API:** `http://localhost:4000` (`/api/v1/health/ready`)
- **AI Service:** `http://localhost:8000` (`/api/v1/health`)

### Option B — Local Development

1. **Database:** Start local pgvector (`docker compose -f docker-compose.dev.yml up -d`) or configure `DATABASE_URL` for Neon PostgreSQL.
2. **Backend:**
   ```bash
   cd backend
   npm install
   npx prisma migrate deploy
   npm run db:seed
   npm run dev
   ```
3. **AI Service:**
   ```bash
   cd ai-service
   python -m venv venv
   source venv/Scripts/activate   # Windows Git Bash
   pip install -r requirements.txt
   alembic upgrade head
   uvicorn app.main:app --reload --port 8000
   ```
4. **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## Verification & Test Suites

| Service | Commands | Coverage |
| :--- | :--- | :--- |
| **AI Service** | `ruff check .` & `pytest` | 90 unit & API tests (RAG, LangGraph supervisor, MCP email schemas/drafts, PDF/DOCX reports) |
| **Backend** | `npm run typecheck && npm run build && npm test` | 104 integration & unit tests across 12 suites (auth, RBAC, documents, threads, email approval, reports, audit, security, health) |
| **Frontend** | `npm run lint && npm test && npm run build` | 42 Vitest component/integration tests across 6 suites + clean Vite production build |
| **E2E (Chromium)** | `npm run test:e2e` | 4 Playwright end-to-end smoke tests (auth redirect, navigation, email draft approval, report generation) |

---

## Operational Documentation

- [Operational Runbook](docs/OPERATIONS_RUNBOOK.md) — Health/readiness probes, Neon point-in-time recovery, secret rotation, and incident triage.
