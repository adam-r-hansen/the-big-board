// components/SiteNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/', label: 'Big Board' },
  { href: '/picks', label: 'Picks' },
  { href: '/scoreboard', label: 'Scoreboard' },
  { href: '/standings', label: 'Standings' },
  { href: '/admin', label: 'Admin' },
  { href: '/profile', label: 'Profile' }, // ✅ NEW
]

export default function SiteNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
      {tabs.map((t) => {
        const active =
          pathname === t.href ||
          (t.href !== '/' && pathname?.startsWith(t.href))

        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              'rounded-lg px-3 py-1.5 text-sm transition ' +
              (active
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-700 hover:bg-neutral-100')
            }
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
