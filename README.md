# ProjectFlow

A production-grade, multi-tenant SaaS project management platform — built with Next.js 14, Node.js/Express, PostgreSQL, Redis, and Socket.IO.

> **Demo:** `admin@demo.com` / `member@demo.com` / `viewer@demo.com` — all use `password123`

---

## Features

### Core
- **Multi-tenancy** — each organization is fully isolated; all queries are scoped to `organizationId`
- **Role-based access control** — `OWNER > ADMIN > MANAGER > MEMBER > VIEWER` hierarchy enforced on both the API and frontend. Role guards hide destructive actions from users who lack permission rather than letting the API silently return 403.
- **Organizations** — create new organizations from the sidebar switcher; rename (ADMIN+); delete with type-to-confirm prompt (OWNER only); switch between multiple orgs with instant navigation
- **Projects** — create, update (MEMBER+), delete with type-to-confirm prompt (MANAGER+); progress tracking; per-project member management
- **Tasks** — full lifecycle (`BACKLOG → TODO → IN_PROGRESS → IN_REVIEW → DONE`), priority levels, due dates, assignees, labels, subtasks, comments, file attachments, and activity log
- **Kanban board** — drag-and-drop columns powered by `@dnd-kit`; real-time sync across all connected users
- **Task list view** — filterable, sortable table with inline editing
- **My Work** — cross-project view of all tasks assigned to the current user, grouped by due-date urgency
- **Full-text search** — search tasks, projects, and comments across the organization
- **Notifications** — real-time bell with unread count; mark individual or all-read
- **Member invitations** — token-based email invites with role assignment
- **Team members page** — manage roles and remove members

### Bonus
| Feature | Details |
|---------|---------|
| **Dark mode** | System / light / dark preference persisted in Zustand + localStorage. Premium surface hierarchy (`#0D1117 → #111318 → #1C1F26 → #22262F`) matching Linear/Vercel quality. |
| **Audit trail** | Every org and project mutation recorded in `AuditLog`. Paginated viewer in Settings (ADMIN+ only). |
| **Webhook system** | Outbound HTTP webhooks with HMAC-SHA256 signing, 11 event types, delivery log UI, secret rotation. |
| **Performance** | `DashboardCharts` dynamically imported (code-split). TanStack Query tuned (`staleTime 30s`, `gcTime 5min`). App Router streaming skeletons on 4 routes for instant perceived load. |
| **Accessibility** | WCAG 2.1 AA — focus trap in modals, `role="listbox"` keyboard navigation, skip-nav link, `:focus-visible` ring, `aria-label` on all icon-only controls. |

---

## Tech Stack

### Backend (`apps/api`)
| Concern | Library |
|---------|---------|
| HTTP server | Express + express-async-errors |
| ORM | Prisma + PostgreSQL |
| Cache / rate limit | ioredis (Redis) |
| Real-time | Socket.IO |
| Auth | JWT (access 15m + refresh 7d, HTTP-only cookie) |
| Validation | Zod |
| Password hashing | bcryptjs |
| API docs | swagger-ui-express |
| Security | helmet, cors, express-rate-limit |

### Frontend (`apps/web`)
| Concern | Library |
|---------|---------|
| Framework | Next.js 14 (App Router) |
| Server state | TanStack Query v5 |
| Client state | Zustand (persisted) |
| Forms | React Hook Form + Zod |
| Styling | Tailwind CSS |
| Real-time | Socket.IO client |
| Drag & Drop | @dnd-kit |
| Charts | Recharts |
| Icons | Lucide React |

---

## Quick Start

### Prerequisites
- Node.js 18+
- Docker (PostgreSQL)
- Redis on `localhost:6379`

### 1. Start infrastructure

**First time only:**
```bash
docker run -d --name project-postgres \
  -e POSTGRES_USER=project_user \
  -e POSTGRES_PASSWORD=project_pass \
  -e POSTGRES_DB=project_mgmt \
  -p 5433:5432 postgres:14-alpine
```

**Subsequent starts:**
```bash
docker start project-postgres
```

### 2. Backend

```bash
cd apps/api
npm install
npm run db:push   # push Prisma schema → DB
npm run db:seed   # seed demo data
npm run dev
# API:   http://localhost:3001
# Docs:  http://localhost:3001/api/docs
```

### 3. Frontend

```bash
cd apps/web
npm install
npm run dev
# App:   http://localhost:3000
```

### Demo credentials

| Email | Password | Role |
|-------|----------|------|
| admin@demo.com | password123 | OWNER |
| manager@demo.com | password123 | MANAGER |
| member@demo.com | password123 | MEMBER |
| viewer@demo.com | password123 | VIEWER |

---

## Architecture

### Backend — Clean Architecture

```
Controllers → Services → Repositories → Prisma (PostgreSQL)
```

| Layer | Responsibility |
|-------|----------------|
| **Controllers** | Parse `req`, call one service method, call `successResponse()` |
| **Services** | Business logic, validation, Socket.IO events, notifications, audit logs |
| **Repositories** | Prisma queries only — no `if` statements beyond `where` clauses |
| **Middleware** | `auth`, `orgAccess`, `validate`, `rateLimiter`, `error` |

Errors are thrown as `AppError` and caught by the central `errorMiddleware` — no try/catch in routes or controllers.

### Frontend — State Split

| State type | Tool |
|-----------|------|
| Server data (tasks, projects, members) | TanStack Query — `useQuery` / `useMutation` + `invalidateQueries` |
| Auth session | Zustand `auth-storage` (persisted) |
| Current org | Zustand `org-storage` (persisted) |
| Theme preference | Zustand `theme-storage` (persisted) |
| Notification bell | Zustand in-memory (not persisted) |

---

## Database Schema

> Full ERD and schema documentation: **[SCHEMA.md](./SCHEMA.md)**

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
Organization ──< Webhook ──< WebhookDelivery
```

**Role hierarchy:** `OWNER > ADMIN > MANAGER > MEMBER > VIEWER`

**Task status flow:** `BACKLOG → TODO → IN_PROGRESS → IN_REVIEW → DONE`

All user-facing entities use **soft deletes** (`deletedAt`). `prisma.*.delete()` is never called directly.

---

## API Reference

Full interactive docs at **http://localhost:3001/api/docs**

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Register + create org |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Logout |
| POST | `/api/v1/auth/forgot-password` | Send reset email |
| POST | `/api/v1/auth/reset-password` | Reset with token |
| GET | `/api/v1/auth/me` | Get current user |
| PATCH | `/api/v1/auth/profile` | Update name, avatar, timezone, notification prefs |
| PATCH | `/api/v1/auth/profile/password` | Change password |

### Organizations
| Method | Path | Min Role | Description |
|--------|------|----------|-------------|
| GET | `/api/v1/organizations` | — | List user's orgs |
| POST | `/api/v1/organizations` | — | Create org (any authenticated user) |
| GET | `/api/v1/organizations/:orgId` | VIEWER | Get org details |
| PATCH | `/api/v1/organizations/:orgId` | ADMIN | Rename org |
| DELETE | `/api/v1/organizations/:orgId` | OWNER | Delete org (cascades all data) |
| GET | `/api/v1/organizations/:orgId/members` | VIEWER | List members |
| POST | `/api/v1/organizations/:orgId/invites` | ADMIN | Invite member with role |
| POST | `/api/v1/organizations/invites/:token/accept` | — | Accept email invite |
| PATCH | `/api/v1/organizations/:orgId/members/:userId/role` | ADMIN | Update member role |
| DELETE | `/api/v1/organizations/:orgId/members/:userId` | ADMIN | Remove member |
| GET | `/api/v1/organizations/:orgId/audit-log` | ADMIN | Paginated audit log |

### Projects
| Method | Path | Min Role | Description |
|--------|------|----------|-------------|
| GET | `/api/v1/organizations/:orgId/projects` | VIEWER | List projects |
| POST | `/api/v1/organizations/:orgId/projects` | MEMBER | Create project |
| GET | `/api/v1/organizations/:orgId/projects/:projectId` | VIEWER | Get project + stats |
| PATCH | `/api/v1/organizations/:orgId/projects/:projectId` | MEMBER | Update project |
| DELETE | `/api/v1/organizations/:orgId/projects/:projectId` | MANAGER | Soft delete project |
| GET | `/api/v1/organizations/:orgId/projects/:projectId/stats` | VIEWER | Stats + burndown data |
| GET/POST/DELETE | `.../labels` | MEMBER | Manage labels |
| GET/POST/DELETE | `.../members` | MANAGER | Manage project members |

### Tasks

> Base: `/api/v1/organizations/:orgId/projects/:projectId/tasks`

| Method | Path | Description |
|--------|------|-------------|
| GET | `.../tasks` | List (filter by status, priority, assignee) |
| GET | `.../tasks/kanban` | Grouped by status for kanban view |
| GET | `.../tasks/export` | Download as CSV |
| POST | `.../tasks` | Create task |
| POST | `.../tasks/bulk` | Bulk move / delete |
| GET | `.../tasks/:taskId` | Task detail |
| PATCH | `.../tasks/:taskId` | Update task |
| DELETE | `.../tasks/:taskId` | Soft delete |
| PATCH | `.../tasks/:taskId/move` | Move (status + position) |
| POST/DELETE | `.../tasks/:taskId/assignees` | Add / remove assignee |
| POST/DELETE | `.../tasks/:taskId/labels` | Add / remove label |
| GET/POST/DELETE | `.../tasks/:taskId/comments` | Comments (supports @mentions) |
| GET/POST/DELETE | `.../tasks/:taskId/attachments` | File attachments |
| GET/POST/PATCH/DELETE | `.../tasks/:taskId/subtasks` | Subtasks |
| GET | `.../tasks/:taskId/activities` | Activity log |

### Webhooks

> Base: `/api/v1/organizations/:orgId/webhooks`

| Method | Path | Description |
|--------|------|-------------|
| GET | `.../webhooks` | List webhooks |
| GET | `.../webhooks/events` | All supported event types |
| POST | `.../webhooks` | Create (returns secret once) |
| PATCH | `.../webhooks/:id` | Update (name, url, events, active) |
| DELETE | `.../webhooks/:id` | Delete |
| POST | `.../webhooks/:id/rotate-secret` | Rotate HMAC signing secret |
| GET | `.../webhooks/:id/deliveries` | Delivery log |

### Other
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/my-tasks` | Tasks assigned to current user (cross-project) |
| GET | `/api/v1/notifications` | List notifications |
| PATCH | `/api/v1/notifications/:id/read` | Mark read |
| POST | `/api/v1/notifications/read-all` | Mark all read |
| GET | `/api/v1/notifications/count` | Unread count |
| GET | `/api/v1/search?q=&orgId=&type=` | Full-text search (tasks, projects, comments) |
| GET | `/api/v1/dashboard/:orgId` | Dashboard stats + chart data |

---

## Real-Time Events (Socket.IO)

### Server → Client
| Event | Payload | Trigger |
|-------|---------|---------|
| `task:created` | Task | Task created |
| `task:updated` | Task | Any task field changed |
| `task:moved` | `{taskId, status, position}` | Drag-drop reorder |
| `task:deleted` | `{taskId, projectId}` | Task deleted |
| `tasks:bulk-updated` | `{projectId, taskIds}` | Bulk status / delete |
| `comment:created` | Comment | New comment posted |
| `notification:new` | Notification | New notification |
| `user:online` | `{userId}` | User connects |
| `user:offline` | `{userId}` | User disconnects |
| `typing:start` / `typing:stop` | `{userId, taskId}` | Typing indicator |

### Client → Server
| Event | Payload |
|-------|---------|
| `join:project` | `projectId` |
| `leave:project` | `projectId` |
| `join:task` | `taskId` |
| `typing:start` / `typing:stop` | `{taskId}` |

---

## Webhook System

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
| `member.removed` | A member is removed |
| `comment.created` | A comment is posted on a task |
| `webhook.test` | Manual test delivery from the UI |

### Request Format

```
POST https://your-endpoint.com/hook
Content-Type: application/json
X-ProjectFlow-Event: task.created
X-ProjectFlow-Delivery: <uuid>
X-ProjectFlow-Signature: sha256=<hmac-hex>
```

### Verifying Signatures

```typescript
import { createHmac, timingSafeEqual } from 'crypto'

function verify(rawBody: string, signature: string, secret: string): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
  return expected.length === signature.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}
```

Deliveries that fail (non-2xx or timeout after 10s) are logged but not retried — inspect them in **Settings → Webhooks → Delivery Log**.

---

## Security

- JWT access tokens (15 min) + refresh tokens (7 days, HTTP-only cookie)
- Rate limiting: 100 req / 15 min general · 10 req / 15 min for auth endpoints
- Helmet security headers
- CORS restricted to frontend origin
- All queries scoped to `organizationId` — no cross-tenant data leakage
- Input validation with Zod on every endpoint
- Soft deletes — data is never permanently removed via the API
- Webhook signatures use HMAC-SHA256 with timing-safe comparison

---

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

# Email — omit in dev; emails print to console instead
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER="noreply@example.com"
SMTP_PASS="your-smtp-password"
SMTP_FROM="ProjectFlow <noreply@example.com>"
```

> **Frontend:** The API base URL is set in `apps/web/src/lib/api.ts`. Update it for production or set `NEXT_PUBLIC_API_URL`.

---

## Deployment

### Recommended Stack (free tier)

```
Vercel    → Next.js frontend   (zero config, auto-deploy from GitHub)
Railway   → Node.js API + PostgreSQL + Redis
```

| Platform | Hosts | Free Tier |
|----------|-------|-----------|
| [Vercel](https://vercel.com) | Next.js frontend | Free forever |
| [Railway](https://railway.app) | API + PostgreSQL + Redis | $5 credit/month |
| [Render](https://render.com) | API + PostgreSQL | Free (sleeps after inactivity) |
| [Supabase](https://supabase.com) | PostgreSQL | Free (500 MB) |
| [Upstash](https://upstash.com) | Redis | Free (10k req/day) |

### Vercel (Frontend)

1. Import repo → set **Root Directory** to `apps/web`
2. Add env var: `NEXT_PUBLIC_API_URL=https://your-api.railway.app/api/v1`
3. Deploy — Vercel auto-detects Next.js

### Railway (Backend + DB + Redis)

1. New Project → Deploy from GitHub → Root: `apps/api`
2. Add **PostgreSQL** and **Redis** services (Railway injects `DATABASE_URL` and `REDIS_URL` automatically)
3. After first deploy:
   ```bash
   npx prisma migrate deploy
   npx ts-node -r tsconfig-paths/register prisma/seed.ts
   ```

### Render (Alternative — fully free)

1. New Web Service → Root: `apps/api` → Build: `npm install && npm run build` → Start: `node dist/index.js`
2. Add a PostgreSQL database
3. Note: free tier sleeps after 15 min of inactivity (~30s cold start)
