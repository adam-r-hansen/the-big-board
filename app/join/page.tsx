// app/join/page.tsx
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function JoinInner() {
  const sp = useSearchParams()
  const leagueId = sp.get('leagueId') || ''
  const [msg, setMsg] = useState('Joining league…')

  useEffect(() => {
    if (!leagueId) {
      setMsg('Missing leagueId')
      return
    }
    ;(async () => {
      try {
        const res = await fetch('/api/leagues/join', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ leagueId }),
          cache: 'no-store',
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`)
        setMsg(j?.already ? 'You are already a member. ✅' : 'Joined! ✅')
      } catch (e: any) {
        setMsg(e?.message || 'Join failed')
      }
    })()
  }, [leagueId])

  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold mb-3">League invite</h1>
      <p className="text-neutral-700 mb-6">{msg}</p>
      <div className="flex items-center justify-center gap-4">
        <a className="underline" href="/picks">Go to Picks</a>
        <a className="underline" href="/standings">Standings</a>
      </div>
    </main>
  )
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-3">League invite</h1>
          <p className="text-neutral-700">Loading…</p>
        </main>
      }
    >
      <JoinInner />
    </Suspense>
  )
}
