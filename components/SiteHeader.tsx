// components/SiteHeader.tsx
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export default async function SiteHeader() {
  const cookieStore = cookies()

  // Create an SSR client with explicit cookie helpers
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get(name: string) {
          // return string | undefined
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options?: Parameters<typeof cookieStore.set>[0] extends object ? any : any) {
          // next/headers set signature expects an object
          cookieStore.set({ name, value, ...(options || {}) })
        },
        remove(name: string, options?: Parameters<typeof cookieStore.set>[0] extends object ? any : any) {
          // delete via setting an expired cookie or using delete (Next 15 supports delete)
          try {
            // Preferred: delete if available
            // @ts-ignore - delete is available in Next 15 runtime
            cookieStore.delete?.(name)
          } catch {
            cookieStore.set({ name, value: '', ...(options || {}), expires: new Date(0) })
          }
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="font-semibold">Big Board</Link>
          <Link href="/picks">Picks</Link>
          <Link href="/scoreboard">NFL Scoreboard</Link>
          <Link href="/standings">League Standings</Link>
          <Link href="/admin" className="hidden sm:inline">Admin</Link>
        </nav>

        <div className="text-sm">
          {user ? (
            <form action="/auth/signout" method="post">
              <span className="mr-3 opacity-70">Signed in: {user.email}</span>
              <button className="rounded-md border px-3 py-1">Sign out</button>
            </form>
          ) : (
            <Link href="/login" className="rounded-md border px-3 py-1">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

