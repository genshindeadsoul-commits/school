# API Reference

Base URL: `http://localhost:8000` (local) or your Render URL in production.
Interactive Swagger UI is always available at **`/docs`**, generated
automatically by FastAPI from the same code as this reference.

Auth: send `Authorization: Bearer <token>` for all `coordinator`/`admin`
endpoints. Tokens come from the login endpoints below and expire after
`ACCESS_TOKEN_EXPIRE_MINUTES` (default 8 hours).

## Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/coordinator/login` | none | `{email, password}` → JWT |
| POST | `/api/auth/admin/login` | none | `{email, password}` → JWT |
| POST | `/api/auth/bootstrap-admin` | secret param | One-time first-admin creation |

## Parent (no auth)

| Method | Path | Description |
|---|---|---|
| POST | `/api/parent/lookup-student` | `{student_id}` → name/class/section |
| POST | `/api/parent/request-pickup` | `{student_id}` → creates pending request |

## Coordinator (JWT: role=coordinator)

| Method | Path | Description |
|---|---|---|
| GET | `/api/coordinator/requests` | Query: `status`, `class`, `search`, `page`, `page_size`. Scoped to caller's `coordinator_id` server-side. |
| POST | `/api/coordinator/requests/{id}/mark-sent` | Sets status=sent, stamps sent_time |
| GET | `/api/coordinator/students` | This coordinator's active students |

## Admin — Students (JWT: role=admin/superadmin)

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/students` | Paginated list, filter by search/class/status |
| POST | `/api/admin/students` | Create student |
| PATCH | `/api/admin/students/{uuid}` | Update fields |
| POST | `/api/admin/students/{uuid}/archive` | Archive |
| POST | `/api/admin/students/{uuid}/restore` | Restore |
| POST | `/api/admin/students/bulk-archive` | By `student_ids`, or `class`(+`section`) |
| GET | `/api/admin/students/bulk-delete/preview?ids=...` | Returns count for confirmation dialog |
| POST | `/api/admin/students/bulk-delete` | Requires `confirmation: "DELETE"` |
| GET | `/api/admin/students/import/template.csv` | Download CSV template |
| GET | `/api/admin/students/import/template.xlsx` | Download Excel template |
| POST | `/api/admin/students/import/preview` | Multipart file → row-by-row validation, no writes |
| POST | `/api/admin/students/import/commit` | Multipart file → imports valid rows only |
| GET | `/api/admin/students/export` | Excel export, filter by `status` |

## Admin — Coordinators

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/coordinators` | List all |
| POST | `/api/admin/coordinators` | Create (hashes password) |
| PATCH | `/api/admin/coordinators/{id}` | Update; password optional |
| DELETE | `/api/admin/coordinators/{id}` | Deletes; unassigns their students first |

## Admin — Dashboard & Reports

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/dashboard-stats` | Today's counts, avg response time, peak hour, breakdowns |
| GET | `/api/admin/reports?period=daily\|weekly\|monthly\|custom&start=&end=` | Row-level report data |
| GET | `/api/admin/reports/export/excel` | Same filters, returns .xlsx |
| GET | `/api/admin/reports/export/pdf` | Same filters, returns .pdf |

## Errors

Standard FastAPI error shape: `{"detail": "message"}` with the appropriate
HTTP status (400 validation, 401 auth, 403 forbidden, 404 not found, 409
conflict, 500 unexpected). All 5xx are caught by a global handler and never
leak stack traces to the client.

## Realtime (not a REST endpoint)

The coordinator dashboard subscribes directly to Supabase Realtime on the
`pickup_requests` table (via `@supabase/supabase-js` using the public `anon`
key, which has no table-read grant — it only receives change *events*, then
the frontend calls the authenticated REST endpoint above to fetch the
actual data). See `frontend/src/pages/CoordinatorDashboard.jsx`.
