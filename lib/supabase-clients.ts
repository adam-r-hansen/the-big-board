// lib/supabase-clients.ts
/**
 * UNIFIED SUPABASE CLIENT LIBRARY
 * 
 * This is the ONLY file you should import Supabase clients from.
 * It provides 3 types of clients for different use cases.
 */

import { createClient } from '@supabase/supabase-js'
import { createServerClient as createSSRServerClient, type CookieOptions } from '@supabase/ssr'
import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ============================================================================
// TYPE 1: BROWSER CLIENT
// ============================================================================
// Use this in CLIENT COMPONENTS (files with 'use client' at the top)
// This client uses the logged-in user's session and respects RLS rules
// ============================================================================

/**
 * Creates a Supabase client for use in browser/client components.
 * 
 * @example
 * 'use client'
 * import { createBrowserSupabaseClient } from '@/lib/supabase-clients'
 * 
 * export default function MyComponent() {
 *   const supabase = createBrowserSupabaseClient()
 *   // Use supabase to query data...
 * }
 */
export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
  }
  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
  }
  
  return createSSRBrowserClient(url, anonKey)
}

// ============================================================================
// TYPE 2: SERVER CLIENT (with user session from cookies)
// ============================================================================
// Use this in SERVER COMPONENTS and SERVER ACTIONS
// This client reads the user's session from cookies and respects RLS rules
// ============================================================================

/**
 * Creates a Supabase client for use in server components with user authentication.
 * Reads the user's session from cookies.
 * 
 * @example
 * import { createServerSupabaseClient } from '@/lib/supabase-clients'
 * 
 * export default async function ServerComponent() {
 *   const supabase = await createServerSupabaseClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 *   // user will be the logged-in user
 * }
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
  }
  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
  }

  return createSSRServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: '', ...options })
      },
    },
  })
}

// ============================================================================
// TYPE 3: ADMIN CLIENT (service role - bypasses RLS)
// ============================================================================
// Use this ONLY in API ROUTES (app/api folder)
// This client bypasses ALL Row Level Security and can access everything
// NEVER expose this to the browser or client components!
// ============================================================================

/**
 * Creates a Supabase admin client with service role key.
 * WARNING: This bypasses ALL Row Level Security rules!
 * ONLY use this in API routes in the app/api folder
 * NEVER use this in client components or expose to browser!
 * 
 * @example
 * // app/api/standings/route.ts
 * import { createAdminSupabaseClient } from '@/lib/supabase-clients'
 * 
 * export async function GET(req: Request) {
 *   const supabase = createAdminSupabaseClient()
 *   // This can access ALL data, regardless of RLS rules
 *   const { data } = await supabase.from('picks').select('*')
 * }
 */
export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.SUPABASE_SERVICE_ROLE!

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
  }
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE) is required')
  }

  return createClient(url, serviceKey, {
    auth: { 
      persistSession: false, 
      autoRefreshToken: false,
      detectSessionInUrl: false 
    },
  })
}

// ============================================================================
// CONVENIENCE EXPORTS (backwards compatibility)
// ============================================================================
// These are shorter aliases if you prefer less typing
// But the full names above are clearer about what they do
// ============================================================================

export const createBrowserClient = createBrowserSupabaseClient
export const createServerClient = createServerSupabaseClient
export const createAdminClient = createAdminSupabaseClient
