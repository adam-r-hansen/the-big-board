// components/AdminNavLink.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Me = { ok: boolean; isAdmin: boolean }

export default function AdminNavLink({ className = 'underline text-sm' }: { className?: string }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await fetch('/api/me', { cache: 'no-store' })
        const j: Me = await r.json()
        if (alive) setIsAdmin(!!j?.isAdmin)
      } catch {
        if (alive) setIsAdmin(false)
      }
    })()
    return () => { alive = false }
  }, [])

  if (!isAdmin) return null
  return <Link className={className} href="/admin">Admin</Link>
}
