// app/me/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function MePage() {
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then((res) => {
      const userEmail = res?.data?.user?.email ?? null
      setEmail(userEmail)
    }).finally(() => setLoading(false))
  }, [])

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold mb-3">My Account</h1>
      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : email ? (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="text-sm text-neutral-500">Signed in as</div>
          <div className="text-lg font-medium">{email}</div>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="text-sm">You’re not signed in.</div>
        </div>
      )}
    </main>
  )
}
