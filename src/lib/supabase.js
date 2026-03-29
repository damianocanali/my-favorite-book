import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Supabase is optional — app works without it (classroom/auth features disabled)
export const supabase = url && key ? createClient(url, key) : null
