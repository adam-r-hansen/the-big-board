// utils/supabase/server.ts
// Legacy compatibility - redirects to new unified clients
export { createServerSupabaseClient as createClient } from '@/lib/supabase-clients'
export { createServerSupabaseClient as createServerClient } from '@/lib/supabase-clients'
