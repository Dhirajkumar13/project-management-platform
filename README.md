# ProjectFlow — Multi-Tenant Project Management Platform

A production-grade SaaS project management platform built with Next.js 14, Node.js, PostgreSQL, Redis, and Socket.IO.

## Quick Start

### Prerequisites
- Node.js 18+
- Docker (for PostgreSQL)
- Redis

### 1. Start infrastructure

```bash
# PostgreSQL via Docker (already running on port 5433)
docker run -d --name project-postgres \
  -e POSTGRES_USER=project_user \
  -e POSTGRES_PASSWORD=project_pass \
  -e POSTGRES_DB=project_mgmt \
  -p 5433:5432 postgres:14-alpine

# Redis must be running on localhost:6379
```

### 2. Backend setup

```bash
cd apps/api
npm install
npm run db:push
npm run db:seed
npm run dev
# → http://localhost:3001
# → API Docs: http://localhost:3001/api/docs
```

### 3. Frontend setup

```bash
cd apps/web
npm install
npm run dev
# → http://localhost:3000
```

### Demo Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@demo.com | password123 | OWNER |
| member@demo.com | password123 | MEMBER |
| viewer@demo.com | password123 | VIEWER |

---

## Architecture

### Backend (apps/api)

Clean Architecture with layered separation:

```
Controllers → Services → Repositories → Prisma (PostgreSQL)
```

| Layer | Responsibility |
|-------|----------------|
| Controllers | HTTP request/response, input validation |
| Services | Business logic, side effects (socket events, notifications) |
| Repositories | Data access, Prisma queries |
| Middleware | Auth, error handling, rate limiting, org access |

**Key packages:**
- `express` + `express-async-errors` — HTTP server
- `@prisma/client` — PostgreSQL ORM
- `ioredis` — Redis for rate limiting & session store
- `socket.io` — Real-time WebSocket events
- `bcryptjs` — Password hashing
- `jsonwebtoken` — JWT access + refresh tokens
- `zod` — Request validation
- `swagger-ui-express` — OpenAPI documentation
- `helmet` + `cors` — Security headers
- `express-rate-limit` — Rate limiting

### Frontend (apps/web)

| Concern | Library |
|---------|---------|
| Framework | Next.js 14 (App Router) |
| State (server) | TanStack Query v5 |
| State (client) | Zustand |
| Forms | React Hook Form + Zod |
| Styling | Tailwind CSS |
| Real-time | Socket.IO client |
| Drag & Drop | @dnd-kit |
| Charts | Recharts |
| Icons | Lucide React |

---

## Database Schema

> Full ERD diagram and schema documentation: **[SCHEMA.md](./SCHEMA.md)**

### Core entities

```
User ──< OrganizationMember >── Organization
Organization ──< Project ──< Task
Task ──< TaskComment
Task ──< TaskAssignee >── User
Task ──< TaskLabel >── Label
Task ──< Subtask
Task ──< TaskActivity
Task ──< TaskAttachment
User ──< Notification
Organization ──< AuditLog
```

### Role Hierarchy

```
OWNER > ADMIN > MANAGER > MEMBER > VIEWER
```

### Task Status Flow

```
BACKLOG → TODO → IN_PROGRESS → IN_REVIEW → DONE
```

---

## API Reference

Full Swagger docs available at: **http://localhost:3001/api/docs**

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/auth/register | Register + create org |
| POST | /api/v1/auth/login | Login |
| POST | /api/v1/auth/refresh | Refresh access token |
| POST | /api/v1/auth/logout | Logout |
| POST | /api/v1/auth/forgot-password | Send reset email |
| POST | /api/v1/auth/reset-password | Reset with token |
| GET | /api/v1/auth/me | Get current user |
| PATCH | /api/v1/auth/profile | Update profile (name, avatar, timezone, notification prefs) |
| PATCH | /api/v1/auth/profile/password | Change password |

### Organizations
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/organizations | List user's orgs |
| POST | /api/v1/organizations | Create org |
| GET | /api/v1/organizations/:orgId | Get org details |
| PATCH | /api/v1/organizations/:orgId | Update org (ADMIN+) |
| GET | /api/v1/organizations/:orgId/members | List members |
| POST | /api/v1/organizations/:orgId/invites | Invite member (ADMIN+) |
| POST | /api/v1/organizations/invites/:token/accept | Accept invite |
| PATCH | /api/v1/organizations/:orgId/members/:userId/role | Update role |
| DELETE | /api/v1/organizations/:orgId/members/:userId | Remove member |
| GET | /api/v1/organizations/:orgId/audit-log | Audit log (ADMIN+) |

### Projects
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/organizations/:orgId/projects | List projects |
| POST | /api/v1/organizations/:orgId/projects | Create project |
| GET | /api/v1/organizations/:orgId/projects/:projectId | Get project |
| PATCH | /api/v1/organizations/:orgId/projects/:projectId | Update project |
| DELETE | /api/v1/organizations/:orgId/projects/:projectId | Delete project |
| GET | /api/v1/organizations/:orgId/projects/:projectId/stats | Project stats |
| GET/POST/DELETE | .../labels | Manage labels |
| GET/POST/DELETE | .../members | Manage project members |

### Tasks

> Base path: `/api/v1/organizations/:orgId/projects/:projectId/tasks`

| Method | Path | Description |
|--------|------|-------------|
| GET | .../tasks | List tasks (filter by status, priority, assignee) |
| GET | .../tasks/kanban | Kanban board grouped by status |
| GET | .../tasks/export | Download tasks as CSV |
| POST | .../tasks | Create task |
| POST | .../tasks/bulk | Bulk move/delete |
| GET | .../tasks/:taskId | Get task detail |
| PATCH | .../tasks/:taskId | Update task |
| DELETE | .../tasks/:taskId | Delete task (soft) |
| PATCH | .../tasks/:taskId/move | Move task (status + position) |
| POST | .../tasks/:taskId/assignees | Add assignee |
| DELETE | .../tasks/:taskId/assignees/:userId | Remove assignee |
| POST | .../tasks/:taskId/labels | Add label |
| DELETE | .../tasks/:taskId/labels/:labelId | Remove label |
| GET | .../tasks/:taskId/comments | List comments |
| POST | .../tasks/:taskId/comments | Create comment (supports @mentions) |
| DELETE | .../tasks/:taskId/comments/:commentId | Delete comment |
| GET | .../tasks/:taskId/attachments | List attachments |
| POST | .../tasks/:taskId/attachments | Upload file (multipart/form-data) |
| DELETE | .../tasks/:taskId/attachments/:attachmentId | Delete attachment |
| GET | .../tasks/:taskId/subtasks | List subtasks |
| POST | .../tasks/:taskId/subtasks | Create subtask |
| PATCH | .../tasks/:taskId/subtasks/:subtaskId | Update subtask |
| DELETE | .../tasks/:taskId/subtasks/:subtaskId | Delete subtask |
| GET | .../tasks/:taskId/activities | Activity log |

### Webhooks

> Base path: `/api/v1/organizations/:orgId/webhooks`

| Method | Path | Description |
|--------|------|-------------|
| GET | .../webhooks | List webhooks for the organization |
| GET | .../webhooks/events | List all supported event types |
| POST | .../webhooks | Create webhook (returns secret once) |
| PATCH | .../webhooks/:id | Update webhook (name, url, events, active) |
| DELETE | .../webhooks/:id | Delete webhook |
| POST | .../webhooks/:id/rotate-secret | Rotate HMAC signing secret |
| GET | .../webhooks/:id/deliveries | List recent delivery attempts |

### Other
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/my-tasks | Tasks assigned to current user (cross-project) |
| GET | /api/v1/notifications | List notifications |
| PATCH | /api/v1/notifications/:id/read | Mark read |
| POST | /api/v1/notifications/read-all | Mark all read |
| GET | /api/v1/notifications/count | Unread count |
| GET | /api/v1/search?q=&orgId=&type= | Full-text search (tasks, projects, comments) |
| GET | /api/v1/dashboard/:orgId | Dashboard stats + charts data |

---

## Real-Time Events (Socket.IO)

### Server → Client
| Event | Payload | Trigger |
|-------|---------|---------|
| `task:created` | Task | New task created |
| `task:updated` | Task | Task field changed |
| `task:moved` | `{taskId, status, position}` | Drag-drop |
| `task:deleted` | `{taskId, projectId}` | Task deleted |
| `tasks:bulk-updated` | `{projectId, taskIds}` | Bulk status/delete |
| `comment:created` | Comment | New comment |
| `notification:new` | Notification | New notification |
| `user:online` | `{userId}` | User connects |
| `user:offline` | `{userId}` | User disconnects |
| `typing:start/stop` | `{userId, taskId}` | Typing indicators |

### Client → Server
| Event | Payload |
|-------|---------|
| `join:project` | projectId |
| `leave:project` | projectId |
| `join:task` | taskId |
| `typing:start/stop` | `{taskId}` |

---

## Bonus Features

The following capabilities were implemented beyond the core requirements:

| Feature | Details |
|---------|---------|
| **Dark Mode** | System/light/dark preference via `theme.store` (Zustand persisted). Toggle in Sidebar. `dark:` Tailwind classes on all major pages. |
| **Audit Trail** | Every org and project mutation is recorded in `AuditLog`. Paginated viewer in Settings (ADMIN+ only). |
| **Webhook System** | Outbound HTTP webhooks with HMAC-SHA256 request signing, 11 event types, fire-and-forget delivery with 10s timeout, and a delivery log UI. |
| **Performance Optimization** | `DashboardCharts` dynamically imported (code-split from initial bundle). TanStack Query tuned (`staleTime=30s`, `gcTime=5min`). App Router streaming skeletons (`loading.tsx`) on 4 dashboard routes for instant perceived load. |
| **WCAG 2.1 AA Accessibility** | `Modal` has focus trap + `role="dialog"` + `aria-modal`. `SelectDropdown` rewritten with `createPortal` + `role="listbox"` / `role="option"` + keyboard navigation. `Avatar` has `role="img"` + `aria-label`. Skip navigation link in dashboard layout. `:focus-visible` ring in `globals.css`. |

---

## Webhook System

### Overview

Webhooks let external systems receive real-time HTTP POST notifications when events occur in ProjectFlow. Configure them in **Settings → Webhooks**.

### Supported Events

| Event | Fires when |
|-------|-----------|
| `project.created` | A new project is created |
| `project.updated` | Project name, description, or status changes |
| `project.deleted` | A project is soft-deleted |
| `task.created` | A new task is created |
| `task.updated` | Any task field changes |
| `task.deleted` | A task is soft-deleted |
| `task.assigned` | A user is added as an assignee |
| `member.invited` | A user is invited to the organization |
| `member.removed` | A member is removed from the organization |
| `comment.created` | A new comment is posted on a task |
| `webhook.test` | Manual test delivery from the UI |

### Request Format

Every delivery is an HTTP POST to your configured URL with these headers:

```
Content-Type: application/json
X-ProjectFlow-Event: task.created
X-ProjectFlow-Delivery: <uuid>
X-ProjectFlow-Signature: sha256=<hex-digest>
```

### Verifying Signatures

The `X-ProjectFlow-Signature` header contains an HMAC-SHA256 digest of the raw request body, signed with your webhook's secret (the `whsec_` value shown at creation or after rotation).

```typescript
import { createHmac } from 'crypto'

function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  // Use timingSafeEqual to prevent timing attacks
  return expected.length === signature.length &&
    require('crypto').timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}
```

**Always verify the signature before processing a delivery.** Deliveries that fail (non-2xx response or timeout after 10s) are logged but not retried automatically — inspect them in Settings → Webhooks → Delivery Log.

---

## Security
- JWT access tokens (15min) + refresh tokens (7d, HTTP-only cookie)
- Rate limiting: 100 req/15min general, 10 req/15min for auth
- Helmet security headers
- CORS configured for frontend origin only
- Organization-level data isolation (all queries scoped to orgId)
- Input validation with Zod on all endpoints
- Soft deletes (data never permanently removed via API)

## Environment Variables

```env
# apps/api/.env
DATABASE_URL="postgresql://project_user:project_pass@localhost:5433/project_mgmt"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="min-32-chars-secret"
JWT_REFRESH_SECRET="min-32-chars-secret"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3001
NODE_ENV="development"
FRONTEND_URL="http://localhost:3000"
UPLOAD_DIR="uploads"
MAX_FILE_SIZE=10485760

# Email (optional — omit for dev; emails log to console instead)
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER="noreply@example.com"
SMTP_PASS="your-smtp-password"
SMTP_FROM="ProjectFlow <noreply@example.com>"
```

> **Frontend**: The API base URL is hardcoded to `http://localhost:3001/api/v1` in `apps/web/src/lib/api.ts`. Change this for production deployment.

---

## Deployment

### Recommended Options

| Platform | Hosts | Free Tier |
|----------|-------|-----------|
| [**Vercel**](https://vercel.com) | Next.js frontend | ✅ Free forever |
| [**Railway**](https://railway.app) | Backend + PostgreSQL + Redis | $5 credit/month |
| [**Render**](https://render.com) | Backend + PostgreSQL | Free (spins down after inactivity) |
| [**Supabase**](https://supabase.com) | PostgreSQL database | Free (500MB) |
| [**Upstash**](https://upstash.com) | Redis | Free (10k requests/day) |

### Recommended Free Stack

```
Vercel          → Next.js frontend (zero config, auto-deploys from GitHub)
Railway         → Node.js API + PostgreSQL + Redis (one project, three services)
```

### Vercel (Frontend)

1. Go to [vercel.com](https://vercel.com) → Import Git Repository → select this repo
2. Set **Root Directory** to `apps/web`
3. Add environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-api.railway.app/api/v1
   ```
4. Deploy — Vercel auto-detects Next.js, no config needed

### Railway (Backend + DB + Redis)

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Add three services: **Node.js app** (root: `apps/api`), **PostgreSQL**, **Redis**
3. Set environment variables from the table above (Railway injects `DATABASE_URL` and `REDIS_URL` automatically)
4. After deploy, run:
   ```bash
   npx prisma migrate deploy
   npx ts-node -r tsconfig-paths/register prisma/seed.ts
   ```

### Render (Alternative — fully free)

1. New Web Service → connect repo → Root Directory: `apps/api` → Build: `npm install && npm run build` → Start: `node dist/index.js`
2. Add a **PostgreSQL** database (free 90 days)
3. Note: free tier services sleep after 15 min of inactivity (cold start ~30s)
