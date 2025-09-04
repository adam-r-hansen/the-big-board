// app/join/page.tsx
'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function JoinInner() {
  const sp = useSearchParams()
  const leagueId = sp.get('leagueId') || ''

  const here = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/join?leagueId=${encodeURIComponent(leagueId)}`
    }
    return `/join?leagueId=${encodeURIComponent(leagueId)}`
  }, [leagueId])

  const [msg, setMsg] = useState('Joining league…')
  const [step, setStep] = useState<'joining' | 'need-email' | 'sent' | 'done' | 'error'>('joining')
  const [email, setEmail] = useState('')

  // 1) Try to join immediately (works if the user already has a session)
  useEffect(() => {
    if (!leagueId) {
      setMsg('Missing leagueId')
      setStep('error')
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

        // No session yet → show email form
        if (res.status === 401) {
          setStep('need-email')
          setMsg('Sign in to join this league.')
          return
        }

        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`)

        setMsg(j?.already ? 'You are already a member. ✅' : 'Joined! ✅')
        setStep('done')
      } catch (e: any) {
        setMsg(e?.message || 'Join failed')
        setStep('error')
      }
    })()
  }, [leagueId])

  // 2) Send magic link
  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    setMsg('Sending magic link…')
    try {
      const res = await fetch('/api/auth/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, redirect: here }),
        cache: 'no-store',
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`)
      setMsg('Magic link sent! Check your email.')
      setStep('sent')
    } catch (err: any) {
      setMsg(err?.message || 'Failed to send magic link')
      setStep('error')
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold mb-3">League invite</h1>

      {step === 'joining' && <p className="text-neutral-700">Joining league…</p>}

      {step === 'need-email' && (
        <>
          <p className="text-neutral-700 mb-6">{msg}</p>
          <form onSubmit={sendLink} className="mx-auto grid gap-3 max-w-sm text-left">
            <label className="grid gap-1">
              <span className="text-sm text-neutral-600">Email</span>
              <input
                className="border rounded px-3 py-2 w-full bg-transparent"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <button className="px-4 py-2 rounded-lg border">Send magic link</button>
          </form>
          <p className="text-xs text-neutral-500 mt-3">We’ll send a sign-in link and bring you back here to finish joining.</p>
        </>
      )}

      {step === 'sent' && (
        <>
          <p className="text-neutral-700 mb-6">{msg}</p>
          <div className="flex items-center justify-center gap-4">
            <a className="underline" href={here}>Back to invite</a>
            <a className="underline" href="/picks">Picks</a>
          </div>
        </>
      )}

      {step === 'done' && (
        <>
          <p className="text-neutral-700 mb-6">{msg}</p>
          <div className="flex items-center justify-center gap-4">
            <a className="underline" href="/picks">Go to Picks</a>
            <a className="underline" href="/standings">Standings</a>
          </div>
        </>
      )}

      {step === 'error' && (
        <>
          <p className="text-neutral-700 mb-6">{msg}</p>
          <div className="flex items-center justify-center gap-4">
            <a className="underline" href={here}>Try again</a>
            <a className="underline" href="/picks">Picks</a>
          </div>
        </>
      )}
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
