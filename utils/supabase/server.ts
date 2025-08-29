// utils/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  // In Next 15, cookies() should be awaited
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(
          name: string,
          value: string,
          options: Parameters<typeof cookieStore.set>[0] extends object ? any : any
        ) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options?: Parameters<typeof cookieStore.set>[0]) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}

