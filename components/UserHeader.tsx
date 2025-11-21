'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const link = 'opacity-80 hover:opacity-100 transition'
const active = 'font-semibold opacity-100'

export default function UserHeader() {
  const pathname = usePathname()
  const is = (p: string) => pathname === p

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-950/70 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-3">
        <Link href="/" className="font-extrabold tracking-tight">Big Board</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/picks" className={`${link} ${is('/picks') ? active : ''}`}>Picks</Link>
          <Link href="/scoreboard" className={`${link} ${is('/scoreboard') ? active : ''}`}>Scoreboard</Link>
          <Link href="/standings" className={`${link} ${is('/standings') ? active : ''}`}>Standings</Link>
          <Link href="/stats" className={`${link} ${is('/stats') ? active : ''}`}>Stats</Link>
          <Link href="/admin" className={`${link} ${is('/admin') ? active : ''}`}>Admin</Link>
          <Link href="/profile" className={`${link} ${is('/profile') ? active : ''}`}>Profile</Link>
        </nav>
      </div>
    </header>
  )
}
