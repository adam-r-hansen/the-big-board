// components/SiteHeader.tsx
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export default async function SiteHeader() {
  // Next 15: cookies() is async
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // Route Handlers/Server Components can set cookies; guard in case of render phase
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            /* no-op */
          }
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/70 dark:border-neutral-800/70 bg-white/70 dark:bg-neutral-950/70 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        {/* Left: nav */}
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/" className="mr-2 font-bold">Big Board</Link>
          <Link href="/picks" className="hover:underline underline-offset-4">Picks</Link>
          <Link href="/scoreboard" className="hover:underline underline-offset-4">NFL Scoreboard</Link>
          <Link href="/standings" className="hover:underline underline-offset-4">League Standings</Link>
          <Link href="/admin" className="hover:underline underline-offset-4">Admin</Link>
        </nav>

        {/* Right: auth */}
        <div className="text-sm">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-neutral-500">
                Signed in: <b>{user.email}</b>
              </span>
              <Link
                href="/auth/signout"
                className="rounded-md border px-2 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                Sign out
              </Link>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-md border px-2 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-900"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

