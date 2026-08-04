# School Student Pickup Management System

A real-time replacement for the manual pickup register. Parents scan one QR
code at the gate, look up their child, and request pickup — no account
needed. Coordinators see live requests for their assigned students and
mark them sent with one click. Admins manage students, coordinators, bulk
imports, and reports.

## Stack

| Layer     | Technology                                      |
|-----------|--------------------------------------------------|
| Frontend  | React (Vite) + Tailwind CSS + React Router        |
| Backend   | FastAPI (Python)                                  |
| Database  | Supabase (PostgreSQL + Realtime + RLS)            |
| Deploy    | Frontend → Vercel · Backend → Render · DB → Supabase |

## Folder Structure

```
pickup-system/
├── backend/                   FastAPI application
│   ├── app/
│   │   ├── core/              config, db client, JWT/password security
│   │   ├── models/            Pydantic request/response schemas
│   │   ├── routers/           auth, parents, coordinators, admin students,
│   │   │                      admin coordinators, admin dashboard/reports
│   │   ├── utils/             audit log helper
│   │   └── main.py            FastAPI app + CORS + router registration
│   ├── requirements.txt
│   ├── .env.example
│   ├── Procfile                 (Render start command)
│   └── runtime.txt               (Python version pin)
│
├── frontend/                  React (Vite) application
│   ├── src/
│   │   ├── pages/              ParentPickup, Login, CoordinatorDashboard,
│   │   │                       AdminDashboard/Students/Coordinators/Import/Reports
│   │   ├── components/         DashboardLayout, ProtectedRoute, OfflineBanner, StatCard
│   │   ├── context/             AuthContext, ThemeContext (dark mode)
│   │   └── lib/                 api.js (backend client), supabaseClient.js (realtime only)
│   ├── package.json
│   ├── vercel.json
│   └── .env.example
│
└── supabase/
    └── schema.sql              Full DB schema, indexes, RLS, realtime, triggers
```

## How It Works

**Parents** (`/`) — no login. Enter Student ID or Admission Number, confirm
the child's name/class/section, tap **Request Pickup**. The request is
inserted with `status = pending`.

**Coordinators** (`/login` → `/coordinator`) — log in and see only requests
for students assigned to them (enforced server-side from the JWT, not from
client-supplied filters). New requests arrive instantly via Supabase
Realtime, with a notification sound and browser notification. One click
marks a request `sent` and stamps `sent_time`.

**Admins** (`/login` → `/admin`) — dashboard stats (today's requests,
pending/sent, average response time, peak hour, breakdowns by class and
coordinator), full student CRUD with archive/restore, bulk archive/delete
(delete requires typing `DELETE` to confirm), CSV/Excel bulk import with
row-level validation preview, coordinator management, and reports (daily/
weekly/monthly/custom range) exportable to Excel or PDF.

## Local Setup

### 1. Database
1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL Editor and run `supabase/schema.sql`.
3. Copy your Project URL, `anon` public key, and `service_role` key from
   **Settings → API**.

### 2. Backend
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, BOOTSTRAP_SECRET
uvicorn app.main:app --reload --port 8000
```

Create your first admin (one-time; the endpoint disables itself once any
admin row exists):
```bash
curl -X POST "http://localhost:8000/api/auth/bootstrap-admin" \
  -d "name=Super Admin" -d "email=admin@school.edu" \
  -d "password=YourStrongPassword" -d "secret=YOUR_BOOTSTRAP_SECRET"
```

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env        # fill in VITE_API_BASE_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev
```

Visit `http://localhost:5173` for the parent pickup page, and
`http://localhost:5173/login` for coordinator/admin sign-in.

## Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full Vercel + Render + Supabase
walkthrough, and [`API_DOCS.md`](./API_DOCS.md) for the endpoint reference
(FastAPI also auto-generates interactive docs at `/docs`).

## Security Notes

- Parents never authenticate; their only capability is looking up an active
  student by ID and creating a pickup request — nothing else is exposed.
- Coordinators authenticate with JWT; every query is scoped server-side to
  `coordinator_id` from the token, so a coordinator cannot access another
  coordinator's students by manipulating request parameters.
- Admins authenticate with JWT and have full access.
- The Supabase `service_role` key lives only in the backend's environment
  and is never sent to the browser. Row Level Security is enabled on every
  table with no policies granted to `anon`, so the frontend's public
  Supabase key (used only for the Realtime subscription) has zero data
  access — it can only listen for change events, not read rows directly.
- Passwords are hashed with bcrypt; never stored or logged in plaintext.
- Bulk delete requires typing `DELETE` to confirm, both client- and
  server-side.

## What's Implemented vs. Simplified

Everything in the spec is implemented end-to-end and functional: realtime
dashboards, RBAC, CSV/Excel import with validation preview, bulk archive/
delete with confirmation, Excel/PDF report export, dark mode, offline
banner, audit logging, pagination, search/filter, and toast notifications.

A few things to be aware of before going to production:
- The seed row in `schema.sql` is a placeholder — use the
  `bootstrap-admin` endpoint instead of the SQL seed to create your real
  first admin (it hashes the password correctly).
- Rate limiting on the public parent endpoints isn't included — add it at
  the reverse-proxy layer (e.g. Render's or Cloudflare's rate limiting) if
  the gate QR code will get heavy concurrent traffic.
- "Activity history" per-student is served by the shared `audit_logs`
  table (filterable by `entity_id`); there's no dedicated UI screen for it
  yet, but the API data is there to build one.
