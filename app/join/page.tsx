// app/join/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function JoinPage() {
  const sp = useSearchParams()
  const router = useRouter()
  const leagueId = sp.get('leagueId') || ''
  const [msg, setMsg] = useState('Joining league…')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!leagueId) { setMsg('Missing leagueId'); setDone(true); return }
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
      } finally {
        setDone(true)
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
