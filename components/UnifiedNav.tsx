// components/UnifiedNav.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavProps {
  userEmail?: string | null
  isAdmin?: boolean
}

export default function UnifiedNav({ userEmail, isAdmin }: NavProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname?.startsWith(href)
  }

  const linkClass = (href: string) => {
    const base = 'text-sm transition-opacity'
    return `${base} ${isActive(href) ? 'font-semibold opacity-100' : 'opacity-80 hover:opacity-100'}`
  }

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-950/70 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
        {/* LEFT: Brand + Navigation */}
        <div className="flex items-center gap-6">
          <Link href="/" className="font-extrabold tracking-tight text-lg">
            Big Board
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/picks" className={linkClass('/picks')}>
              Picks
            </Link>
            <Link href="/scoreboard" className={linkClass('/scoreboard')}>
              Scoreboard
            </Link>
            <Link href="/standings" className={linkClass('/standings')}>
              Standings
            </Link>
            {isAdmin && (
              <Link href="/admin" className={linkClass('/admin')}>
                Admin
              </Link>
            )}
            <Link href="/profile" className={linkClass('/profile')}>
              Profile
            </Link>
          </nav>
        </div>

        {/* RIGHT: Auth */}
        <div className="flex items-center gap-3 text-sm">
          {userEmail ? (
            <>
              <span className="opacity-60 hidden sm:inline">{userEmail}</span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
