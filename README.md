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

## Security

- Passwords hashed with bcrypt (12 rounds)
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
