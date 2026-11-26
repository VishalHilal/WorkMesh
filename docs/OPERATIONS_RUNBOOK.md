# WorkMesh AI — Operational Runbook

## 1. Health & Readiness Probes

| Endpoint | Purpose | Expected `200 OK` | `503` Meaning |
| :--- | :--- | :--- | :--- |
| `GET /` | Liveness check (Render/load balancer) | `{ status: "ok" }` | Process down |
| `GET /api/v1/health` | Backend + PostgreSQL check | `services.database === "ok"` | Neon DB unreachable |
| `GET /api/v1/health/ready` | Deep readiness (PostgreSQL + Python AI service) | `database === "ok"` & `aiService === "ok"` | DB or AI service degraded |

---

## 2. Database Backup & Restore (Neon PostgreSQL)

- **Point-in-time recovery**: Use Neon Console → **Branches → Restore** to create a recovery branch from any timestamp before a bad migration or incident.
- **Schema migrations**:
  ```bash
  cd backend
  npx prisma migrate deploy
  ```
- **AI service vector schema (Alembic)**:
  ```bash
  cd ai-service
  alembic upgrade head
  ```

---

## 3. Secret Rotation Plan

| Secret | Services | Zero-Downtime Rotation Steps |
| :--- | :--- | :--- |
| `JWT_ACCESS_SECRET` | `backend` | Update env var in Render and redeploy; existing 15m access tokens expire naturally, forcing clean re-login. |
| `INTERNAL_API_KEY` | `backend`, `ai-service` | Update `INTERNAL_API_KEY` in Hugging Face Space / AI service and Render backend together, then restart both services. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | `backend`, `ai-service` | Create new Neon Object Storage key pair, deploy to both services, verify document/report upload & download, then revoke old key. |
| `CORS_ORIGINS` | `backend` | Comma-separated allowlist of trusted frontend origins (e.g., `https://workmesh.vercel.app`). |

---

## 4. Incident Triage Checklist

1. **Check `/api/v1/health/ready`**: Identify whether `database` or `aiService` is reporting `"error"`.
2. **Trace with `X-Request-Id`**: Every HTTP response and error envelope (`meta.requestId`) carries the correlation ID; grep structured `HTTP_REQUEST` logs by `requestId`.
3. **Audit Trail Inspection**: Admins can inspect `EMAIL_DRAFT_*`, `REPORT_*`, `DOCUMENT_*`, and auth events via **Audit Logs** (`/admin/audit-logs`).
