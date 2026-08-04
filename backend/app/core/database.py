"""Supabase client, initialized once and reused across the app.

We use the SERVICE ROLE key here (server-side only, never shipped to the
frontend). All authorization checks happen in application code
(see core/security.py and each router's dependency checks) — RLS on the
tables blocks the anon key entirely as defense-in-depth.
"""
from supabase import create_client, Client
from app.core.config import settings

supabase: Client = create_client(
    settings.supabase_url,
    settings.supabase_service_role_key,
)
