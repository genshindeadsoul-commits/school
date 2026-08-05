-- ============================================================
-- School Student Pickup Management System — Supabase Schema
-- ============================================================
-- Run this entire file in the Supabase SQL Editor.

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- ENUM TYPES
-- ------------------------------------------------------------
do $$ begin
  create type student_status as enum ('active', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('pending', 'sent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type admin_role as enum ('admin', 'superadmin');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- ADMINS
-- ------------------------------------------------------------
create table if not exists admins (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique not null,
  password_hash text not null,
  role admin_role not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- COORDINATORS
-- ------------------------------------------------------------
create table if not exists coordinators (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique not null,
  password_hash text not null,
  assigned_classes text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- STUDENTS
-- ------------------------------------------------------------
create table if not exists students (
  id uuid primary key default uuid_generate_v4(),
  student_id text unique not null,
  admission_no text unique,
  name text not null,
  class text not null,
  section text not null,
  coordinator_id uuid references coordinators(id) on delete set null,
  status student_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_students_student_id on students(student_id);
create index if not exists idx_students_class_section on students(class, section);
create index if not exists idx_students_coordinator on students(coordinator_id);
create index if not exists idx_students_status on students(status);

-- ------------------------------------------------------------
-- PICKUP REQUESTS
-- ------------------------------------------------------------
create table if not exists pickup_requests (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  coordinator_id uuid references coordinators(id) on delete set null,
  request_time timestamptz not null default now(),
  sent_time timestamptz,
  status request_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_requests_status on pickup_requests(status);
create index if not exists idx_requests_coordinator on pickup_requests(coordinator_id);
create index if not exists idx_requests_created_at on pickup_requests(created_at);
create index if not exists idx_requests_student on pickup_requests(student_id);

create unique index if not exists uniq_pending_request_per_student
  on pickup_requests(student_id)
  where status = 'pending';

-- ------------------------------------------------------------
-- AUDIT LOG
-- ------------------------------------------------------------
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_type text not null,
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_created_at on audit_logs(created_at);
create index if not exists idx_audit_entity on audit_logs(entity_type, entity_id);

-- ------------------------------------------------------------
-- updated_at TRIGGER HELPER
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_students_updated_at on students;
create trigger trg_students_updated_at before update on students
  for each row execute function set_updated_at();

drop trigger if exists trg_coordinators_updated_at on coordinators;
create trigger trg_coordinators_updated_at before update on coordinators
  for each row execute function set_updated_at();

drop trigger if exists trg_admins_updated_at on admins;
create trigger trg_admins_updated_at before update on admins
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
-- The FastAPI backend uses the Supabase SERVICE ROLE key and enforces
-- authorization in application code (see backend/app/core/security.py).
-- RLS is enabled as defense-in-depth: no policies are granted to anon,
-- so the public/anon key has zero table access. service_role bypasses RLS.

alter table students enable row level security;
alter table coordinators enable row level security;
alter table admins enable row level security;
alter table pickup_requests enable row level security;
alter table audit_logs enable row level security;

-- Supabase Realtime only pushes postgres_changes events to a client if RLS
-- explicitly allows that client's role to SELECT the row — this is required
-- even though the frontend never queries this table directly (only the
-- backend, via service_role, reads/writes it). Without this policy, realtime
-- silently sends nothing and coordinator dashboards need a manual refresh.
-- pickup_requests has no student names or personal info in its own columns
-- (just UUIDs, timestamps, and status), so this is a low-risk, narrow grant.
drop policy if exists "allow anon select for realtime" on pickup_requests;
create policy "allow anon select for realtime" on pickup_requests
  for select to anon using (true);

-- ------------------------------------------------------------
-- REALTIME
-- ------------------------------------------------------------
alter publication supabase_realtime add table pickup_requests;

-- ------------------------------------------------------------
-- SEED: create your real superadmin via the backend's
-- `POST /api/auth/bootstrap-admin` endpoint (one-time, disables itself
-- after the first admin exists) rather than inserting a row here —
-- that endpoint hashes the password correctly with bcrypt.
-- ------------------------------------------------------------
