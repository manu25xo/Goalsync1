# GoalSync — AtomQuest Performance Portal

A full-stack Goal Setting & Tracking Portal built with **React + Vite** (frontend) and **Node.js + Express + PostgreSQL** (backend).

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 18, Vite, React Router v6     |
| Backend    | Node.js, Express 4                  |
| Database   | PostgreSQL 16                       |
| Auth       | JWT (jsonwebtoken + bcryptjs)       |
| Charts     | Recharts                            |
| Container  | Docker + Docker Compose             |

---

## Project Structure

```
goalsync/
├── backend/
│   ├── src/
│   │   ├── db/          # pool.js, migrate.js, seed.js
│   │   ├── middleware/  # auth.js, errors.js
│   │   ├── routes/      # auth, users, goals, achievements, checkins, cycles, reports
│   │   ├── utils/       # scores.js
│   │   └── index.js     # Express app entry
│   ├── .env
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/         # Axios client + all API calls
│   │   ├── components/  # UI, Sidebar, GoalCard, GoalFormModal, AchievementModal
│   │   ├── contexts/    # AuthContext
│   │   ├── pages/       # All page components
│   │   ├── App.jsx      # Router + protected routes
│   │   └── main.jsx
│   └── package.json
├── docker-compose.yml
└── package.json
```

---

## Option A — Run Locally (Recommended for Development)

### Prerequisites
- Node.js 18+ → https://nodejs.org
- PostgreSQL 14+ → https://www.postgresql.org/download/
- npm 9+

### Step 1 — Create the database

```bash
# Connect to PostgreSQL
psql -U postgres

# Inside psql:
CREATE DATABASE goalsync;
\q
```

### Step 2 — Install dependencies

```bash
# From the project root:
cd goalsync

npm install                                  # root devDeps (concurrently)
cd backend  && npm install && cd ..
cd frontend && npm install && cd ..
```

### Step 3 — Configure environment

The backend `.env` file is already pre-filled for local dev at `backend/.env`.
Edit it if your PostgreSQL credentials differ:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=goalsync
DB_USER=postgres
DB_PASSWORD=postgres        # ← change if needed
JWT_SECRET=goalsync_dev_secret_key_change_in_prod
```

### Step 4 — Run database migrations

```bash
cd backend
npm run migrate
```

Expected output:
```
🔄 Running migrations...
✅ Migrations complete.
```

### Step 5 — Seed demo data

```bash
npm run seed
```

Expected output:
```
✅ Seed complete.

📋 Demo credentials (password: password123):
  Admin:    admin@company.com
  Manager:  manager1@company.com  (Engineering)
  Manager:  manager2@company.com  (Sales)
  Employee: emp1@company.com  (Arjun Sharma)
  Employee: emp2@company.com  (Priya Mehta)
  Employee: emp3@company.com  (Sneha Patel)
```

### Step 6 — Run both servers

```bash
# From project root — starts BOTH frontend and backend:
cd ..   # back to goalsync root
npm run dev
```

Or run them separately in two terminals:

```bash
# Terminal 1 — Backend (port 4000)
cd backend
npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev
```

### Step 7 — Open the app

```
http://localhost:5173
```

---

## Option B — Docker Compose (One Command)

### Prerequisites
- Docker Desktop → https://www.docker.com/products/docker-desktop/

### Run

```bash
cd goalsync

# Build and start everything (DB + backend + frontend)
docker-compose up --build

# Run migrations + seed (first time only, in a new terminal):
docker exec goalsync_api node src/db/migrate.js
docker exec goalsync_api node src/db/seed.js
```

### Open

```
http://localhost:5173
```

### Stop

```bash
docker-compose down

# To also delete DB data:
docker-compose down -v
```

---

## Demo Accounts

All passwords: `password123`

| Role     | Email                    | Name         | Team         |
|----------|--------------------------|--------------|--------------|
| Admin    | admin@company.com        | Divya Nair   | HR           |
| Manager  | manager1@company.com     | Rahul Verma  | Engineering  |
| Manager  | manager2@company.com     | Amit Kapoor  | Sales        |
| Employee | emp1@company.com         | Arjun Sharma | Engineering  |
| Employee | emp2@company.com         | Priya Mehta  | Engineering  |
| Employee | emp3@company.com         | Sneha Patel  | Sales        |

---

## API Endpoints

| Method | Endpoint                          | Access           | Description                    |
|--------|-----------------------------------|------------------|--------------------------------|
| POST   | /api/auth/login                   | Public           | Login, returns JWT             |
| GET    | /api/auth/me                      | Auth             | Current user info              |
| GET    | /api/users                        | Auth             | List users (role-scoped)       |
| POST   | /api/users                        | Admin            | Create user                    |
| GET    | /api/goals                        | Auth             | List goals (role-scoped)       |
| POST   | /api/goals                        | Emp/Mgr/Admin    | Create goal                    |
| PATCH  | /api/goals/:id                    | Auth             | Edit goal                      |
| POST   | /api/goals/:id/submit             | Employee         | Submit for approval            |
| POST   | /api/goals/:id/approve            | Manager/Admin    | Approve goal                   |
| POST   | /api/goals/:id/reject             | Manager/Admin    | Reject / return for rework     |
| POST   | /api/goals/:id/unlock             | Admin            | Unlock approved goal           |
| POST   | /api/goals/shared                 | Manager/Admin    | Push shared goal to team       |
| DELETE | /api/goals/:id                    | Owner/Admin      | Delete draft goal              |
| PUT    | /api/achievements/:goalId/:quarter| Auth             | Log quarterly actual           |
| GET    | /api/achievements                 | Auth             | Get achievements for a goal    |
| POST   | /api/checkins                     | Manager/Admin    | Add check-in comment           |
| GET    | /api/checkins                     | Auth             | List check-in comments         |
| GET    | /api/cycles                       | Auth             | List cycles                    |
| POST   | /api/cycles                       | Admin            | Create cycle                   |
| PATCH  | /api/cycles/:id/activate          | Admin            | Set active cycle               |
| GET    | /api/reports/dashboard            | Mgr/Admin        | Org-wide stats                 |
| GET    | /api/reports/achievement          | Mgr/Admin        | Achievement data               |
| GET    | /api/reports/achievement/csv      | Mgr/Admin        | Download CSV report            |
| GET    | /api/reports/audit                | Mgr/Admin        | Paginated audit trail          |
| GET    | /health                           | Public           | Health check                   |

---

## Features Implemented

### Employee
- ✅ Add up to 8 goals per cycle
- ✅ Weightage validation (min 10%, total must = 100%)
- ✅ All UoM types: Numeric, Min, Max, %, Timeline, Zero
- ✅ Submit goals for manager approval
- ✅ Edit / delete draft goals
- ✅ Log Q1–Q4 achievements with live score preview
- ✅ View manager check-in comments
- ✅ Read-only shared (pushed) goals (can only change weightage)

### Manager
- ✅ View all team members' goals
- ✅ Approve / Return for rework / Reject goals
- ✅ Push shared goals to multiple employees
- ✅ Add quarterly check-in comments
- ✅ View team achievement report

### Admin
- ✅ Full org-wide visibility
- ✅ User management (create, view, edit)
- ✅ Cycle/window management (create, activate)
- ✅ Unlock approved goals (exception handling)
- ✅ Achievement report with CSV export
- ✅ Full audit trail

---

## Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `ECONNREFUSED 5432` | PostgreSQL not running. Start it: `brew services start postgresql` (Mac) or `sudo service postgresql start` (Linux) |
| `database "goalsync" does not exist` | Run `psql -U postgres -c "CREATE DATABASE goalsync;"` |
| `role "postgres" does not exist` | Change `DB_USER` in `.env` to your local PostgreSQL username |
| Port 4000 in use | Change `PORT=4001` in `backend/.env` and update Vite proxy in `frontend/vite.config.js` |
| Port 5173 in use | Vite will auto-try 5174, 5175, etc. |
| `invalid signature` JWT error | `JWT_SECRET` mismatch — clear `localStorage` in browser and re-login |
