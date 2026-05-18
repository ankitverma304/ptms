# PTMS — Project & Ticket Management System

Full-stack system with MySQL, Node.js/Express backend, and React frontend.

---

## Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.x running locally
- npm

---

### 1. Database Setup

```bash
# Log into MySQL and run the schema
mysql -u root -p < database/schema.sql
```

This creates the `ptms` database with all tables, triggers, indexes, and seed data.

**Seed accounts (password: `Admin@1234`):**
| Email | Role |
|---|---|
| superadmin@ptms.dev | Super Admin |
| admin@ptms.dev | Admin |
| alice@ptms.dev | Project Manager |
| bob@ptms.dev | Team Lead |
| dev1@ptms.dev | Developer |
| dev2@ptms.dev | Developer |
| qa@ptms.dev | QA |

---

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env — set DB_PASSWORD, JWT_SECRET, REFRESH_TOKEN_SECRET
npm install
npm run dev   # starts on http://localhost:5000
```

**Verify:**
```bash
curl http://localhost:5000/health
# → {"status":"ok","db":"connected"}
```

---

### 3. Frontend Setup

```bash
cd frontend
npm install
npm start     # starts on http://localhost:3000
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/v1/auth/register | Register new user |
| POST | /api/v1/auth/login | Login, get JWT + refresh token |
| POST | /api/v1/auth/refresh | Refresh access token |
| POST | /api/v1/auth/logout | Invalidate refresh token |
| GET  | /api/v1/auth/me | Get current user |

### Projects
| Method | Endpoint | Description |
|---|---|---|
| GET    | /api/v1/projects | List projects (filtered by membership) |
| POST   | /api/v1/projects | Create project |
| GET    | /api/v1/projects/:id | Get project + members |
| PUT    | /api/v1/projects/:id | Update project |
| DELETE | /api/v1/projects/:id | Delete project (Admin only) |
| GET    | /api/v1/projects/:id/dashboard | Stats dashboard |
| POST   | /api/v1/projects/:id/members | Add member |
| DELETE | /api/v1/projects/:id/members/:userId | Remove member |

### Tickets
| Method | Endpoint | Description |
|---|---|---|
| GET    | /api/v1/projects/:projectId/tickets | List tickets (paginated) |
| POST   | /api/v1/tickets | Create ticket |
| GET    | /api/v1/tickets/:id | Get full ticket (history, comments, time logs, points) |
| PUT    | /api/v1/tickets/:id | Update ticket / change status |
| DELETE | /api/v1/tickets/:id | Delete ticket |
| POST   | /api/v1/tickets/:id/log-bug | Log bug + deduct points |
| POST   | /api/v1/tickets/:id/adjust-points | Manual point adjustment (Admin) |

### Time Logs
| Method | Endpoint | Description |
|---|---|---|
| POST   | /api/v1/time-logs | Log time against a ticket |
| GET    | /api/v1/tickets/:ticketId/time-logs | Time logs for a ticket |
| GET    | /api/v1/users/:userId/timeline | Personal timeline + bug summary + points |
| PUT    | /api/v1/time-logs/:id | Edit time log |
| DELETE | /api/v1/time-logs/:id | Delete time log |

### Comments
| Method | Endpoint | Description |
|---|---|---|
| GET    | /api/v1/tickets/:ticketId/comments | List comments |
| POST   | /api/v1/tickets/:ticketId/comments | Create comment (supports @mention, /assign) |
| PUT    | /api/v1/comments/:id | Edit comment (15 min window) |
| DELETE | /api/v1/comments/:id | Soft-delete comment |

### Reports
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/v1/reports/user-performance | Points + ticket stats per user |
| GET | /api/v1/reports/bug-analytics | Bug count by severity, trend, top authors |
| GET | /api/v1/reports/project-progress | Ticket status breakdown per project |
| GET | /api/v1/reports/time-tracking | Hours by user and project |
| GET | /api/v1/reports/leaderboard | Developer points ranking |
| GET | /api/v1/reports/overdue | All overdue tickets |

---

## Points System

| Event | Points | Condition |
|---|---|---|
| Complete on time | **+1** | Closed on or before due_date |
| Complete overdue | **-1** | Closed after due_date |
| Minor bug | **-1** | Fix time ≤ 15 minutes |
| Major bug | **-5** | Fix time < 2 hours |
| Critical bug | **-10** | Fix time > 5 hours |

Formula:
```
Net Score = (on_time × 1) + (overdue × −1) + (minor × −1) + (major × −5) + (critical × −10)
```

Bug points are triggered via `POST /api/v1/tickets/:id/log-bug` with `fix_minutes`.

---

## Database Tables

| Table | Purpose |
|---|---|
| users | All system users with roles and total_points |
| projects | Projects with PM, dates, status |
| project_members | Many-to-many user-project membership |
| tickets | Core ticket records with status workflow |
| ticket_history | Immutable audit log of all ticket mutations |
| comments | Ticket comments (soft-delete, @mentions) |
| time_logs | Hour entries per user per ticket |
| bugs | Bug records with severity and fix time |
| ticket_points_log | Every point event (source of truth for scoring) |
| notifications | In-app notification queue |
| tags / ticket_tags / project_tags | Tagging system |
| ticket_checklists | Sub-tasks within tickets |
| ticket_dependencies | blocks / blocked-by relationships |
| refresh_tokens | JWT refresh token store |

---

## Real-time Events (Socket.IO)

| Event (emit) | Payload | Description |
|---|---|---|
| join_project | projectId | Subscribe to project updates |
| join_user | userId | Subscribe to personal notifications |

| Event (listen) | Description |
|---|---|
| ticket_status | Ticket status changed |
| new_comment | Comment posted on a watched ticket |
| ticket_assigned | You were assigned a ticket |
| points_updated | Your score changed |

---

## Project Structure

```
ptms/
├── database/
│   └── schema.sql          ← Run this first
├── backend/
│   ├── server.js           ← Entry point
│   ├── .env.example        ← Copy to .env
│   ├── config/db.js        ← MySQL pool
│   ├── middleware/
│   │   ├── auth.js         ← JWT + RBAC
│   │   ├── errorHandler.js
│   │   └── validate.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── projectController.js
│   │   ├── ticketController.js
│   │   ├── timeLogController.js
│   │   ├── commentController.js
│   │   ├── reportController.js
│   │   └── userController.js
│   ├── services/
│   │   ├── pointsService.js    ← All points logic
│   │   └── notificationService.js
│   └── routes/index.js
└── frontend/
    └── src/
        ├── App.jsx
        ├── context/
        │   ├── AuthContext.jsx
        │   └── SocketContext.jsx
        ├── utils/api.js        ← All API calls
        ├── components/Layout.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── DashboardPage.jsx
            ├── ProjectsPage.jsx
            ├── ProjectDetail.jsx
            ├── TicketDetail.jsx
            ├── ReportsPage.jsx
            ├── LeaderboardPage.jsx
            ├── TimelinePage.jsx
            └── UsersPage.jsx
```
