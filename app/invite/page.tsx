'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

function InviteInner() {
  const router = useRouter()
  const sp = useSearchParams()
  const [msg, setMsg] = useState('')

  const leagueId = useMemo(() => (sp.get('leagueId') || '').trim(), [sp])

  useEffect(() => {
    let aborted = false
    ;(async () => {
      setMsg('Checking session…')

      if (!leagueId) {
        setMsg('Missing leagueId in invite link.')
        return
      }

      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getUser()
        const user = data?.user
        if (!user) {
          const redirect = `/invite?leagueId=${encodeURIComponent(leagueId)}`
          router.replace(`/auth?redirect=${encodeURIComponent(redirect)}`)
          return
        }
      } catch {
        // continue; server will validate auth and respond accordingly
      }

      setMsg('Accepting invite…')
      try {
        const res = await fetch('/api/invite/accept', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ leagueId }),
          cache: 'no-store',
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) {
          setMsg(j?.error || `Invite failed (HTTP ${res.status})`)
          return
        }
        if (aborted) return
        setMsg('Joined! Redirecting…')
        router.replace(`/picks?leagueId=${encodeURIComponent(leagueId)}`)
      } catch (e: any) {
        if (aborted) return
        setMsg(e?.message || 'Invite error')
      }
    })()
    return () => {
      aborted = true
    }
  }, [leagueId, router])

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold mb-2">Joining league…</h1>
      <div className="text-sm text-neutral-600">{msg || 'Working…'}</div>
      {!leagueId && (
        <div className="mt-4 text-xs">
          Try opening the invite link again, or ask your commissioner to resend it.
        </div>
      )}
    </main>
  )
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-4 py-10">
          <h1 className="text-2xl font-semibold mb-2">Joining league…</h1>
          <div className="text-neutral-600">Loading…</div>
        </main>
      }
    >
      <InviteInner />
    </Suspense>
  )
}
