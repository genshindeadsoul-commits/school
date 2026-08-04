// Public Supabase client, used ONLY for subscribing to realtime changes
// on pickup_requests. All reads/writes of actual data go through the
// FastAPI backend, which uses the service-role key and enforces
// authorization — the anon key here has no table access (see schema.sql).
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, anonKey)
