// app/invite/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function InvitePage() {
  const sp = useSearchParams()
  const router = useRouter()
  const leagueId = sp.get('leagueId') || ''
  const [msg, setMsg] = useState('Checking your invite…')

  useEffect(() => {
    if (!leagueId) {
      setMsg('Missing leagueId in the link.')
      return
    }
    let canceled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/invite/accept?leagueId=${encodeURIComponent(leagueId)}`, { cache: 'no-store' })
        const j = await r.json().catch(() => ({}))
        if (canceled) return

        if (r.status === 401) {
          // Not logged in: send them to your auth page and boomerang back to this invite.
          // If your auth route differs, change "/auth" below to your sign-in page.
          const redirect = encodeURIComponent(`/invite?leagueId=${leagueId}`)
          router.replace(`/auth?redirect=${redirect}`)
          return
        }

        if (!r.ok) {
          setMsg(j?.error || `Invite failed (HTTP ${r.status})`)
          return
        }

        const to = j?.redirect || `/picks?leagueId=${encodeURIComponent(leagueId)}`
        setMsg('All set — taking you to your league…')
        router.replace(to)
      } catch (e: any) {
        if (!canceled) setMsg(e?.message || 'Something went wrong finishing your invite.')
      }
    })()
    return () => { canceled = true }
  }, [leagueId, router])

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-xl font-semibold mb-2">Joining your league…</h1>
      <p className="text-sm text-neutral-600">{msg}</p>

      {/* Fallback action if a user bookmarks this page while logged out */}
      {msg.toLowerCase().includes('missing') && (
        <div className="mt-4 text-sm">
          Double-check the link you received from your commissioner.
        </div>
      )}
      {msg.toLowerCase().includes('unauth') && (
        <div className="mt-4 text-sm">
          Please sign in and we’ll finish the invite automatically.
        </div>
      )}
    </main>
  )
}
