import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export type SessionUser = { id: string; email?: string | null }

export async function getServerSupabase() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }) },
        remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }) },
      },
    }
  )
  return supabase
}

export async function requireSession() {
  const sb = await getServerSupabase()
  const { data, error } = await sb.auth.getUser()
  if (error || !data?.user) throw Object.assign(new Error('unauthenticated'), { status: 401 })
  const u: SessionUser = { id: data.user.id, email: (data.user as any).email ?? null }
  return { supabase: sb, user: u }
}
