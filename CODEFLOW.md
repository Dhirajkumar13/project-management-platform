# ProjectFlow — Architecture & Code Flow Guide

A developer reference explaining how every layer of the system connects, where files live, and how data moves through the application.

## Live Deployment

| Service | Platform | URL |
|---------|----------|-----|
| **Frontend** (Next.js 14) | Vercel | https://project-management-platform-web.vercel.app |
| **Backend API** (Node.js / Express) | Render | https://projectflow-api-wijm.onrender.com |
| **API Docs** (Swagger UI) | Render | https://projectflow-api-wijm.onrender.com/api/docs |
| **Database** (MongoDB) | MongoDB Atlas (M0 free cluster) | — |
| **Cache / Queue** (Redis) | Upstash | — |

> Render free tier sleeps after 15 min of inactivity — first request after sleep takes ~30s.

---

## Table of Contents

1. [Repository Structure](#1-repository-structure)
2. [Backend Request Flow](#2-backend-request-flow)
3. [Frontend Page Load Flow](#3-frontend-page-load-flow)
4. [Authentication Flow](#4-authentication-flow)
5. [Real-Time Flow (Socket.IO)](#5-real-time-flow-socketio)
6. [Multi-Tenancy Enforcement](#6-multi-tenancy-enforcement)
7. [Role-Based Access Control](#7-role-based-access-control)
8. [Key Files Reference](#8-key-files-reference)
9. [Local Setup Step-by-Step](#9-local-setup-step-by-step)
10. [Webhook Delivery Flow](#10-webhook-delivery-flow)

---

## 1. Repository Structure

```
project-management-platform/          ← npm workspaces monorepo root
├── package.json                      ← workspace config (links apps/api + apps/web)
├── README.md                         ← quick start + API reference
│
├── apps/
│   ├── api/                          ← Node.js + Express backend (port 3001)
│   │   ├── prisma/
│   │   │   ├── schema.prisma         ← SINGLE SOURCE OF TRUTH for all DB models
│   │   │   └── seed.ts               ← creates demo org + 4 users + projects + tasks
│   │   └── src/
│   │       ├── config/               ← one file per external dependency
│   │       │   ├── database.ts       ← exports `prisma` client singleton
│   │       │   ├── env.ts            ← validates all env vars at startup (throws if missing)
│   │       │   ├── redis.ts          ← exports `redis` ioredis client
│   │       │   ├── socket.ts         ← Socket.IO server setup + room helpers
│   │       │   ├── swagger.ts        ← OpenAPI spec builder (scans routes/*.ts for JSDoc)
│   │       │   └── logger.ts         ← winston logger (console in dev, file in prod)
│   │       │
│   │       ├── middleware/           ← Express middleware — runs BEFORE controllers
│   │       │   ├── auth.ts           ← `authenticate` — verifies JWT, attaches req.user
│   │       │   ├── orgAccess.ts      ← `orgAccess` — checks org membership, attaches req.orgMember
│   │       │   ├── validate.ts       ← `validate(schema)` — Zod parse of req.body (returns 422 on fail)
│   │       │   ├── rateLimiter.ts    ← general (100/15min) + auth (10/15min) limiters
│   │       │   └── error.ts          ← catches all thrown AppError/Error, returns JSON
│   │       │
│   │       ├── controllers/          ← HTTP in/out ONLY — no business logic
│   │       │   ├── auth.controller.ts
│   │       │   ├── organization.controller.ts
│   │       │   ├── project.controller.ts
│   │       │   └── task.controller.ts
│   │       │
│   │       ├── services/             ← ALL business logic lives here
│   │       │   ├── auth.service.ts
│   │       │   ├── organization.service.ts   ← wires AuditLog on all mutations
│   │       │   ├── project.service.ts        ← wires AuditLog + webhookService.trigger()
│   │       │   ├── task.service.ts           ← calls webhookService.trigger() after mutations
│   │       │   └── webhook.service.ts        ← HMAC-SHA256 signing, fire-and-forget delivery, delivery logging
│   │       │
│   │       ├── repositories/         ← Prisma queries ONLY — no business rules
│   │       │   ├── auth.repository.ts
│   │       │   ├── organization.repository.ts
│   │       │   ├── project.repository.ts
│   │       │   ├── task.repository.ts
│   │       │   └── webhook.repository.ts     ← Webhook CRUD, findActiveByOrgAndEvent, createDelivery, listDeliveries
│   │       │
│   │       ├── routes/               ← Express routers + Swagger JSDoc annotations
│   │       │   ├── auth.routes.ts
│   │       │   ├── organization.routes.ts
│   │       │   ├── project.routes.ts
│   │       │   ├── task.routes.ts
│   │       │   ├── notification.routes.ts
│   │       │   ├── search.routes.ts
│   │       │   ├── dashboard.routes.ts
│   │       │   ├── my-tasks.routes.ts
│   │       │   └── webhook.routes.ts         ← mounted at /organizations/:orgId/webhooks
│   │       │
│   │       ├── types/
│   │       │   └── index.ts          ← AuthenticatedRequest, ROLE_HIERARCHY, PaginationParams
│   │       │
│   │       ├── utils/
│   │       │   ├── email.ts          ← nodemailer (logs to console in dev, sends via SMTP in prod)
│   │       │   ├── jwt.ts            ← sign/verify access + refresh tokens
│   │       │   ├── pagination.ts     ← getSkip(), getPagination() helpers
│   │       │   └── response.ts       ← successResponse(), paginatedResponse() — all responses go through here
│   │       │
│   │       └── index.ts              ← app entry point: Express setup, route mounting, Socket.IO init
│   │
│   └── web/                          ← Next.js 14 App Router frontend (port 3000)
│       └── src/
│           ├── app/
│           │   ├── layout.tsx                    ← root layout: QueryClientProvider, Toaster
│           │   ├── page.tsx                      ← redirects / → /login
│           │   ├── globals.css                   ← Tailwind base + :focus-visible ring
│           │   │
│           │   ├── (auth)/                       ← public routes (no sidebar)
│           │   │   ├── layout.tsx                ← centered card layout
│           │   │   ├── login/page.tsx
│           │   │   ├── register/page.tsx
│           │   │   ├── forgot-password/page.tsx
│           │   │   └── reset-password/page.tsx   ← reads ?token= from URL
│           │   │
│           │   ├── (dashboard)/                  ← protected routes (with sidebar)
│           │   │   ├── layout.tsx                ← auth guard + Socket.IO connect + skip nav link
│           │   │   └── dashboard/[orgSlug]/
│           │   │       ├── page.tsx              ← org dashboard (stats + charts)
│           │   │       ├── loading.tsx           ← App Router streaming skeleton (dashboard)
│           │   │       ├── my-work/page.tsx      ← tasks assigned to current user
│           │   │       ├── search/page.tsx       ← full-text search with debounce
│           │   │       ├── profile/page.tsx      ← profile, password change, notification prefs
│           │   │       ├── members/page.tsx      ← org members + invite
│           │   │       ├── settings/page.tsx     ← org rename (ADMIN+) + org delete with confirm (OWNER) + Webhooks + Audit Log
│           │   │       └── projects/
│           │   │           ├── page.tsx          ← project list
│           │   │           ├── loading.tsx       ← App Router streaming skeleton (project list)
│           │   │           └── [projectId]/
│           │   │               ├── page.tsx      ← project detail + edit (MEMBER+) + delete with confirm (MANAGER+)
│           │   │               ├── loading.tsx   ← App Router streaming skeleton (project detail)
│           │   │               ├── kanban/page.tsx  ← drag-and-drop board (@dnd-kit)
│           │   │               └── list/
│           │   │                   ├── page.tsx  ← sortable table + bulk actions + CSV export
│           │   │                   └── loading.tsx  ← App Router streaming skeleton (list view)
│           │   │
│           │   └── invite/[token]/page.tsx       ← public invite acceptance page
│           │
│           ├── components/
│           │   ├── dashboard/
│           │   │   └── DashboardCharts.tsx       ← Recharts (dynamically imported — not in initial bundle)
│           │   ├── layout/
│           │   │   ├── Header.tsx                ← notification bell + unread count
│           │   │   └── Sidebar.tsx               ← nav links + org switcher (create org modal) + dark mode toggle + user profile link
│           │   ├── modals/
│           │   │   └── TaskDetailModal.tsx       ← full task editor (comments, assignees, subtasks, attachments)
│           │   └── ui/
│           │       ├── Avatar.tsx                ← image or initials fallback, role="img" + aria-label
│           │       ├── Badge.tsx                 ← colored status/priority chips
│           │       ├── Button.tsx                ← variants: primary, outline, ghost, danger
│           │       ├── Modal.tsx                 ← accessible: role="dialog", aria-modal, focus trap, Escape key
│           │       ├── SelectDropdown.tsx        ← createPortal-based dropdown, role="listbox"/"option", keyboard nav
│           │       ├── Spinner.tsx               ← loading states
│           │       └── ThemeProvider.tsx         ← applies/removes `dark` class on document.documentElement
│           │
│           ├── lib/
│           │   ├── api.ts            ← Axios instance (baseURL=localhost:3001) + token interceptor + 401 refresh logic
│           │   ├── queryClient.ts    ← TanStack Query config (staleTime=30s, gcTime=5min, retry=1)
│           │   ├── socket.ts         ← Socket.IO client singleton (connectSocket called once in dashboard layout)
│           │   └── utils.ts          ← cn(), PRIORITY_COLORS, STATUS_LABELS, formatDate, hasOrgRole(), getInitials, etc.
│           │
│           ├── store/
│           │   ├── auth.store.ts           ← Zustand persisted (localStorage) — user + accessToken
│           │   ├── org.store.ts            ← Zustand persisted — currentOrg, setCurrentOrg, clearOrg
│           │   ├── notification.store.ts   ← Zustand in-memory — notification bell state
│           │   └── theme.store.ts          ← Zustand persisted (localStorage) — preference: 'light'|'dark'|'system' + resolveTheme()
│           │
│           └── types/
│               └── index.ts          ← ALL TypeScript interfaces matching API response shapes
```

---

## 2. Backend Request Flow

Every API request travels through exactly these layers in order:

```
HTTP Request
    │
    ▼
Express Router (routes/*.ts)
    │  matches the URL path and HTTP method
    │
    ▼
Middleware Chain (runs left to right on the route definition)
    ├── generalLimiter       ← rate limit (100 req/15min)
    ├── authenticate         ← verifies JWT → attaches req.user
    ├── orgAccess            ← checks org membership → attaches req.orgMember
    └── validate(schema)     ← Zod parse of req.body → 422 if invalid
    │
    ▼
Controller (controllers/*.ts)
    │  parses req.params / req.query / req.body
    │  calls exactly ONE service method
    │  calls successResponse() or paginatedResponse()
    │
    ▼
Service (services/*.ts)
    │  all business logic here
    │  orchestrates repository calls
    │  emits Socket.IO events after mutations
    │  calls webhookService.trigger(event, orgId, payload) after mutations
    │  records AuditLog entries (org + project mutations)
    │  sends emails via utils/email.ts
    │  creates TaskActivity records
    │  throws AppError if rules are violated
    │
    ▼
Repository (repositories/*.ts)
    │  Prisma queries ONLY
    │  always includes organizationId scope
    │  uses taskInclude / projectInclude for consistent JOIN shapes
    │
    ▼
Prisma ORM → MongoDB (port 27018)
    │
    ▼
Response via utils/response.ts
    └── successResponse(res, data, 200)
    └── paginatedResponse(res, items, total, page, limit)

── On any thrown error ──────────────────────────────
AppError bubbles up → errorMiddleware (middleware/error.ts)
    └── returns { success: false, message, statusCode }
```

### Concrete Example — Move a Task (Kanban drag-and-drop)

```
PATCH /api/v1/organizations/:orgId/projects/:projectId/tasks/:taskId/move
  │
  ├── authenticate         → confirms JWT is valid, req.user = { id, email, name }
  ├── orgAccess            → confirms user is member of :orgId, req.orgMember = { role }
  └── validate(moveTaskSchema) → confirms { status, position } are valid enums/numbers
  │
  ▼ taskController.moveTask(req, res)
      → extracts { taskId, projectId, orgId } from params
      → extracts { status, position } from req.body
      → calls taskService.moveTask(taskId, projectId, status, position, orgId, userId)
  │
  ▼ taskService.moveTask(...)
      → calls taskRepository.findById(taskId, projectId)   — 404 if not found
      → calls taskRepository.update(taskId, { status, position })
      → creates TaskActivity record { action: 'moved task', oldValue: prevStatus, newValue: status }
      → emits socket event: emitToProject(projectId, 'task:moved', { taskId, status, position })
      → returns updated task
  │
  ▼ taskController
      → successResponse(res, updatedTask)   → { success: true, data: Task }
```

---

## 3. Frontend Page Load Flow

### App Router Layout Hierarchy

```
app/layout.tsx                    ← QueryClientProvider + Toaster (wraps everything)
  └── app/(dashboard)/layout.tsx  ← auth guard + Socket.IO connection
        └── dashboard/[orgSlug]/page.tsx   ← actual page content
```

### How a dashboard page loads data

```
User navigates to /dashboard/acme-corp
    │
    ▼
(dashboard)/layout.tsx
    ├── reads useAuthStore() — if no user → redirect /login
    ├── connectSocket(accessToken) — joins socket rooms
    └── renders <Sidebar /> + <main>{children}</main>
    │
    ▼
dashboard/[orgSlug]/page.tsx
    ├── reads useOrgStore() → currentOrg.id
    ├── useQuery({ queryKey: ['dashboard', orgId], queryFn: () => api.get('/dashboard/:orgId') })
    │       └── Axios request interceptor reads auth-storage from localStorage
    │           → sets Authorization: Bearer {token} on every request
    ├── renders stat cards from data
    └── renders <DashboardCharts data={data} />
            └── dynamically imported (recharts bundle loads separately, not blocking first paint)
```

### TanStack Query — The Data Layer

All server data goes through TanStack Query. The flow for any query:

```
useQuery({ queryKey: ['kanban', projectId], queryFn: ... })
    │
    ├── cache hit + data is fresh (< 30s old)?  → return cached data immediately
    │
    ├── cache hit but stale?  → return cached data + background refetch
    │
    └── cache miss?  → show loading state → fetch from API → store in cache
```

After a mutation (create/update/delete), invalidate the relevant query key:
```typescript
qc.invalidateQueries({ queryKey: ['kanban', projectId] })
// This marks the cache as stale → triggers background refetch → UI updates automatically
```

### Axios Token Flow (lib/api.ts)

```
Every request:
  request interceptor → reads localStorage['auth-storage'] → sets Authorization header

401 response received from a non-auth endpoint:
  response interceptor → POST /auth/refresh (refresh token is in HTTP-only cookie)
                       → receives new accessToken
                       → updates localStorage['auth-storage']
                       → retries original failed request once

Retry also fails:
  → clears auth-storage from localStorage
  → redirects to /login

401 response from /auth/* endpoints (login, register, etc.):
  → bypass refresh logic entirely
  → error propagates to the caller (e.g. login page shows "Incorrect credentials")
  → no redirect, no page reload
```

---

## 4. Authentication Flow

### Registration

```
POST /api/v1/auth/register { name, email, password, orgName }
    │
    ├── bcrypt.hash(password, 12)
    ├── prisma.user.create(...)
    ├── prisma.organization.create({ name: orgName, slug: slugify(orgName) })
    ├── prisma.organizationMember.create({ userId, orgId, role: OWNER })
    ├── sign accessToken (JWT, 15min, payload: { userId })
    ├── sign refreshToken (JWT, 7d)
    ├── prisma.refreshToken.create({ token: hashedRefreshToken, userId })
    ├── res.cookie('refreshToken', token, { httpOnly: true, sameSite: 'lax' })
    └── return { user, accessToken }
```

### Login → API Call → Token Refresh

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser                                                         │
│                                                                 │
│  [Login Form] ──POST /auth/login──→ API                         │
│                ←── { user, accessToken }                        │
│                ←── Set-Cookie: refreshToken (HTTP-only)         │
│                                                                 │
│  Zustand auth.store: setAuth(user, accessToken)                 │
│  localStorage['auth-storage'] = { user, accessToken }          │
│                                                                 │
│  [Any API call] ──→ request interceptor adds Bearer token       │
│                                                                 │
│  [15 min later — token expires]                                 │
│  [API call] ──→ 401 response                                    │
│  response interceptor ──POST /auth/refresh──→ API               │
│                        (cookie sent automatically by browser)   │
│                ←── { accessToken: newToken }                    │
│  updates localStorage, retries original request                 │
└─────────────────────────────────────────────────────────────────┘
```

### Password Reset Flow

```
User enters email → POST /auth/forgot-password
    │
    ├── creates PasswordReset record { token: uuid, expiresAt: now+1h }
    └── sends email: /reset-password?token=<uuid>

User clicks email link → /reset-password?token=<uuid>  (frontend page)
    │
    └── POST /auth/reset-password { token, password }
            ├── finds PasswordReset where token matches + not expired + not used
            ├── bcrypt.hash(newPassword)
            ├── updates user.password
            ├── marks PasswordReset.used = true
            └── returns success
```

---

## 5. Real-Time Flow (Socket.IO)

### Connection

```
Dashboard layout mounts
    └── connectSocket(accessToken)
            └── io(socketUrl, { auth: { token } })
                    ├── dev: http://localhost:3001
                    ├── prod: https://projectflow-api-wijm.onrender.com
                    └── server middleware verifies JWT → socket.data.userId = userId
```

### Room Topology

Every user is in multiple rooms simultaneously:

```
socket joins on connect (server-side — apps/api/src/config/socket.ts):
  user:{userId}              ← private notifications for this user (always joined)
  org:{orgId}                ← joined for every org the user belongs to
                               (server reads all memberships; orgIds stored on socket
                                for scoped disconnect cleanup)

socket joins when viewing a project (join:project event from client):
  project:{projectId}        ← board updates, task events

socket joins when viewing a task (join:task event from client):
  task:{taskId}              ← typing indicators, comment updates

On disconnect:
  user leaves all project/task rooms they joined
  org rooms are cleaned up using the orgIds stored on socket.data
  user:{userId} room is left automatically by Socket.IO
```

### Event Flow — Task Updated

```
User edits task title in TaskDetailModal
    │
    ▼
PATCH /api/v1/.../tasks/:taskId  { title: 'New title' }
    │
    ▼
taskService.update(...)
    ├── taskRepository.update(taskId, { title })
    ├── creates TaskActivity { action: 'updated title', oldValue, newValue }
    └── emitToProject(projectId, 'task:updated', updatedTask)
                └── io.to(`project:${projectId}`).emit('task:updated', task)
    │
    ▼
All browsers with that project open receive 'task:updated'
    └── they call qc.invalidateQueries(['kanban', projectId])
        → board refreshes with the new title
```

---

## 6. Multi-Tenancy Enforcement

Data isolation happens at 4 levels — all must pass:

```
Level 1 — Route Middleware (orgAccess.ts)
  Every request to /organizations/:orgId/* runs:
    prisma.organizationMember.findFirst({ where: { organizationId: orgId, userId: req.user.id } })
    → 403 if not a member (attacker learns nothing about the org)

Level 2 — Repository Queries (double-scoped)
  projectRepository.findById(projectId, orgId):
    prisma.project.findFirst({ where: { id: projectId, organizationId: orgId, deletedAt: null } })
    → returns null if projectId belongs to a different org → 404

Level 3 — Task Queries (triple-scoped through project)
  taskRepository.findById(taskId, projectId):
    prisma.task.findFirst({ where: { id: taskId, projectId, deletedAt: null } })
    → projectId was already validated as belonging to orgId in the project layer

Level 4 — Schema Constraints
  @@unique([organizationId, userId])  ← no duplicate org memberships
  @@unique([projectId, userId])       ← no duplicate project members
  @@unique([taskId, userId])          ← no duplicate assignees
```

---

## 7. Role-Based Access Control

### Hierarchy

```
OWNER > ADMIN > MANAGER > MEMBER > VIEWER
```

Encoded as numeric weights in both the API (`ROLE_HIERARCHY` in `apps/api/src/types/index.ts`) and the frontend (`hasOrgRole` in `apps/web/src/lib/utils.ts`). The API is the authority — the frontend guards are UX only (they hide buttons the user can't use, preventing silent 403s).

### API Enforcement

Every mutating route applies `requireOrgRole(minRole)` middleware:

```
router.patch('/:orgId', orgAccess, requireOrgRole('ADMIN'), ...)  ← org rename
router.delete('/:orgId', orgAccess, requireOrgRole('OWNER'), ...)  ← org delete
router.post('/projects', requireOrgRole('MEMBER'), ...)            ← create project
router.patch('/:projectId', requireOrgRole('MEMBER'), ...)         ← update project
router.delete('/:projectId', requireOrgRole('MANAGER'), ...)       ← delete project
```

`requireOrgRole` reads `req.orgMember.role` (set by `orgAccess`) and compares via `hasRole(userRole, minRole)`. Returns 403 if insufficient.

### Frontend Enforcement

```typescript
// apps/web/src/lib/utils.ts
export const hasOrgRole = (userRole: OrgRole | undefined, minRole: OrgRole): boolean =>
  userRole !== undefined && ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole]
```

`currentOrg.role` carries the current user's role (returned by `GET /organizations`). Use it to conditionally render action buttons:

```tsx
// Project detail page — edit gated to MEMBER+, delete gated to MANAGER+
{hasOrgRole(currentOrg?.role, 'MEMBER') && <button onClick={() => setShowEdit(true)}><Pencil /></button>}
{hasOrgRole(currentOrg?.role, 'MANAGER') && <button onClick={() => setShowDelete(true)}><Trash2 /></button>}

// Settings page — Save Changes gated to ADMIN+
{hasOrgRole(currentOrg?.role, 'ADMIN') ? <Button type="submit">Save</Button> : <p>Admins only</p>}

// Danger Zone — only OWNER sees it
{currentOrg?.role === 'OWNER' && <DangerZone />}
```

### Destructive Action Pattern — Type-to-Confirm

Both org delete and project delete require the user to type the resource name before the button activates. This prevents accidental deletion.

```
User clicks Delete → modal opens
  └── input: type "{resource.name}" to confirm
  └── Delete button disabled until input === resource.name
  └── on confirm → DELETE /api/v1/... → success
        ├── qc.invalidateQueries([...])
        ├── clearOrg() [if deleting active org]
        └── router.push(safe route)
```

### Permission Matrix

| Action | API Min Role | Frontend Guard |
|--------|-------------|----------------|
| Create org | any auth user | — |
| Rename org | ADMIN | Save button hidden for MEMBER/VIEWER |
| Delete org | OWNER | Danger Zone section hidden for non-OWNER |
| Create project | MEMBER | — |
| Edit project | MEMBER | Edit button hidden for VIEWER |
| Delete project | MANAGER | Delete button hidden for VIEWER/MEMBER |
| Invite member | ADMIN | — |
| Change member role | ADMIN | — |
| Remove member | ADMIN | — |
| View audit log | ADMIN | — |
| Manage webhooks | ADMIN | — |

---

## 8. Key Files Reference

| File | What it does |
|------|-------------|
| `apps/api/prisma/schema.prisma` | All database models — edit this first when adding entities |
| `apps/api/src/config/env.ts` | Validates all required env vars at startup — add new vars here |
| `apps/api/src/index.ts` | Mounts all routes — add new route files here |
| `apps/api/src/middleware/auth.ts` | JWT verification — `req.user` is set here |
| `apps/api/src/middleware/orgAccess.ts` | Org membership check — `req.orgMember` is set here |
| `apps/api/src/utils/response.ts` | All responses go through `successResponse()` or `paginatedResponse()` |
| `apps/api/src/types/index.ts` | `AuthenticatedRequest`, `ROLE_HIERARCHY`, `hasRole()` |
| `apps/web/src/lib/api.ts` | Axios client with token injection + refresh logic |
| `apps/web/src/lib/queryClient.ts` | TanStack Query global config (staleTime, gcTime, retry) |
| `apps/web/src/lib/utils.ts` | `cn()`, `formatDate()`, `PRIORITY_COLORS`, `STATUS_LABELS`, `ROLE_COLORS`, `hasOrgRole()` — frontend role guard |
| `apps/web/src/store/auth.store.ts` | Persisted auth state — user + accessToken |
| `apps/web/src/store/org.store.ts` | Persisted current org — `currentOrg`, `setCurrentOrg`, `clearOrg` (call after org deletion) |
| `apps/web/src/types/index.ts` | All frontend TypeScript interfaces matching API shapes |
| `apps/web/src/app/(dashboard)/layout.tsx` | Auth guard + Socket.IO init + skip nav |

---

## 9. Local Setup Step-by-Step

### Prerequisites

- Node.js 18+
- Docker Desktop running
- Redis running on localhost:6379

### Step 1 — Start MongoDB

**First time only:**
```bash
docker run -d --name project-mongo -p 27018:27017 mongo:7 --replSet rs0
docker exec project-mongo mongosh --eval \
  'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
```

**Subsequent starts:**
```bash
docker start project-mongo
```

### Step 2 — Backend

```bash
cd apps/api

# Create environment file
cat > .env << 'EOF'
DATABASE_URL="mongodb://127.0.0.1:27018/project_mgmt?directConnection=true&replicaSet=rs0"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="supersecretjwtkeyminimum32characters"
JWT_REFRESH_SECRET="supersecretrefreshtokenkey32chars"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3001
NODE_ENV="development"
FRONTEND_URL="http://localhost:3000"
UPLOAD_DIR="uploads"
MAX_FILE_SIZE=10485760
EOF

npm install
npm run db:push    # syncs schema.prisma → MongoDB
npm run db:seed    # creates demo users + org + projects + tasks
npm run dev        # starts on http://localhost:3001
```

Swagger docs: **http://localhost:3001/api/docs**

### Step 3 — Frontend

```bash
cd apps/web
npm install
npm run dev        # starts on http://localhost:3000
```

### Step 4 — Login with demo accounts

| Email | Password | Role |
|-------|----------|------|
| admin@demo.com | password123 | OWNER |
| manager@demo.com | password123 | MANAGER |
| member@demo.com | password123 | MEMBER |
| viewer@demo.com | password123 | VIEWER |

### Adding a New Feature (Entity Pattern)

To add a new entity (e.g. `Sprint`), follow this order:

1. `prisma/schema.prisma` — add the model
2. `npm run db:push` — sync to database
3. `src/repositories/sprint.repository.ts` — Prisma queries only
4. `src/services/sprint.service.ts` — business logic
5. `src/controllers/sprint.controller.ts` — HTTP in/out only
6. `src/routes/sprint.routes.ts` — router + Swagger JSDoc
7. `src/index.ts` — mount the new router
8. `apps/web/src/types/index.ts` — add TypeScript interface
9. Frontend page + TanStack Query hooks

Never skip a layer. Never put Prisma in a controller. Never put business logic in a repository.

---

## 10. Webhook Delivery Flow

### End-to-End: Project Created → Webhook Fired

```
POST /api/v1/organizations/:orgId/projects
    │
    ▼
projectService.create(orgId, data, userId)
    ├── projectRepository.create(orgId, data)  → new Project row
    ├── creates AuditLog { action: 'project.created', ... }
    ├── emitToOrg(orgId, 'project:created', project)   ← Socket.IO (real-time UI)
    └── webhookService.trigger('project.created', orgId, { project })
```

```
webhookService.trigger('project.created', orgId, payload)
    │
    ├── webhookRepository.findActiveByOrgAndEvent(orgId, 'project.created')
    │       └── SELECT * FROM Webhook
    │           WHERE organizationId = orgId
    │             AND active = true
    │             AND 'project.created' = ANY(events)
    │
    └── for each matching webhook:
            ├── build request body: { event, deliveryId (uuid), timestamp, data: payload }
            ├── compute signature:
            │     HMAC-SHA256(secret, JSON.stringify(body)) → hex
            │     header: X-ProjectFlow-Signature: sha256=<hex>
            ├── fire-and-forget HTTP POST (10s timeout, no retry)
            │     headers: Content-Type, X-ProjectFlow-Event, X-ProjectFlow-Delivery, X-ProjectFlow-Signature
            └── webhookRepository.createDelivery({
                    webhookId, event, payload,
                    responseStatus,   ← HTTP status from destination (null if connection error)
                    responseBody,     ← first 1000 chars of response
                    success           ← true if 2xx received within timeout
                })
```

### Delivery is Fire-and-Forget

The HTTP request to the destination URL is made **outside the API response cycle** — the original API caller receives a response immediately. If the destination is slow or unreachable, it does not block the API.

Failed deliveries (non-2xx or timeout) are logged in `WebhookDelivery` with `success: false`. They are **not retried automatically**. Users can inspect the delivery log in Settings → Webhooks.

### Verifying a Delivery (Consumer Side)

```typescript
import { createHmac, timingSafeEqual } from 'crypto'

function verify(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
}
```

**Always compare with `timingSafeEqual`** to prevent timing-based forgery attacks. Reject any delivery where the signature does not match.
