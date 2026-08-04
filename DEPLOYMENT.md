# Deployment Guide

Three pieces to deploy: **Supabase** (database), **Render** (FastAPI backend),
**Vercel** (React frontend).

## 1. Supabase (Database)

1. Create a project at [supabase.com](https://supabase.com) — pick a region
   close to your school for lowest latency.
2. Go to **SQL Editor** → paste the contents of `supabase/schema.sql` → **Run**.
3. Go to **Settings → API** and note down:
   - `Project URL`
   - `anon` `public` key (frontend, realtime only)
   - `service_role` key (backend only — keep secret)
4. Go to **Database → Replication** and confirm `pickup_requests` is listed
   under the `supabase_realtime` publication (the schema script adds it
   automatically, but it's worth a visual check).

## 2. Backend → Render

1. Push this repo to GitHub.
2. In Render, **New → Web Service**, connect the repo, set **Root Directory**
   to `backend`.
3. Build command: `pip install -r requirements.txt`
   Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   (Render also auto-detects the included `Procfile`.)
4. Add environment variables (Render dashboard → Environment):
   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   JWT_SECRET=<generate a long random string>
   JWT_ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=480
   FRONTEND_ORIGIN=https://your-frontend.vercel.app
   BOOTSTRAP_SECRET=<random string, used once>
   ```
5. Deploy. Once live, create your first admin:
   ```bash
   curl -X POST "https://your-backend.onrender.com/api/auth/bootstrap-admin" \
     -d "name=Super Admin" -d "email=admin@school.edu" \
     -d "password=YourStrongPassword" -d "secret=YOUR_BOOTSTRAP_SECRET"
   ```
   This endpoint permanently refuses further calls once any admin exists —
   safe to leave deployed.
6. Visit `https://your-backend.onrender.com/docs` to confirm the API is live
   and browse the interactive Swagger docs.

**Note on Render free tier:** free web services spin down after inactivity,
which adds a ~30s cold-start delay to the first request after idle. For a
school gate used daily during pickup hours, consider a paid instance to
avoid parents hitting a slow cold start.

## 3. Frontend → Vercel

1. In Vercel, **Add New → Project**, import the repo, set **Root Directory**
   to `frontend`.
2. Framework preset: Vite (auto-detected).
3. Add environment variables:
   ```
   VITE_API_BASE_URL=https://your-backend.onrender.com
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon public key>
   ```
4. Deploy. `vercel.json` is already configured to rewrite all routes to
   `index.html` so React Router's client-side routes work on refresh.
5. Go back to Render and update `FRONTEND_ORIGIN` to your final Vercel URL
   (needed for CORS), then redeploy the backend.

## 4. Generate the Gate QR Code

Point any QR generator (e.g. `qrencode`, or an online tool) at your
frontend's root URL — e.g. `https://your-frontend.vercel.app/`. Print it and
post it at the pickup gate. No further configuration needed; it's a plain
static URL.

## 5. Post-Deploy Checklist

- [ ] Bootstrap admin created and bootstrap endpoint now returns 403 (confirms it disabled itself)
- [ ] Log in as admin, add at least one coordinator
- [ ] Add or bulk-import a few test students, assigning the coordinator
- [ ] Open the frontend root URL on a phone, look up a test student, submit a pickup request
- [ ] Confirm the coordinator dashboard receives it in real time with sound + browser notification
- [ ] Mark it sent, confirm it disappears from "Pending"
- [ ] Run a daily report and export both Excel and PDF
- [ ] Test bulk archive and bulk delete (with the `DELETE` confirmation) on dummy data only
