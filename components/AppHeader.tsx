import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export default async function AppHeader() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set() {},
        remove() {},
      },
    }
  )
  const { data } = await supabase.auth.getUser()
  const user = data.user
  const email = user?.email || ''
  const adminList = (process.env.ADMIN_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)
  const isAdmin = email && adminList.includes(email.toLowerCase())

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-950/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-3">
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/" className="font-semibold">Big Board</Link>
          <Link href="/picks" className="opacity-80 hover:opacity-100">Picks</Link>
          <Link href="/scoreboard" className="opacity-80 hover:opacity-100">Scoreboard</Link>
          <Link href="/standings" className="opacity-80 hover:opacity-100">Standings</Link>
          {isAdmin && <Link href="/admin" className="opacity-80 hover:opacity-100">Admin</Link>}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/profile" className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm">
                Profile
              </Link>
              <Link href="/login" className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm">
                Sign out
              </Link>
            </>
          ) : (
            <Link href="/login" className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  )
}

