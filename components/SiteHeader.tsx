// components/SiteHeader.tsx
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

export default async function SiteHeader() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user ?? null

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        {/* LEFT: nav */}
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="font-semibold">Big Board</Link>
          <Link href="/picks" className="opacity-80 hover:opacity-100">Picks</Link>
          <Link href="/scoreboard" className="opacity-80 hover:opacity-100">Scoreboard</Link>
          <Link href="/standings" className="opacity-80 hover:opacity-100">Standings</Link>
          <Link href="/stats" className="opacity-80 hover:opacity-100">Stats</Link>
          <Link href="/admin" className="opacity-80 hover:opacity-100">Admin</Link>
        </nav>

        {/* RIGHT: auth */}
        <div className="text-sm">
          {user ? (
            <form action="/auth/signout" method="post">
              <span className="mr-3 opacity-80">{user.email}</span>
              <button className="rounded-md border px-2 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-900">
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="rounded-md border px-3 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-900"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
