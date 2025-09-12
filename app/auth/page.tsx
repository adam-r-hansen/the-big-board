// app/auth/page.tsx
'use client'

import { Suspense, useCallback, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function AuthInner() {
  const router = useRouter()
  const sp = useSearchParams()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  // Carry a redirect back to where we want (usually /invite?leagueId=...)
  const redirectParam = sp.get('redirect') || ''
  const emailRedirectTo = useMemo(() => {
    const r = redirectParam || '/'
    try {
      const origin = window.location.origin
      return r.startsWith('http') ? r : `${origin}${r.startsWith('/') ? r : `/${r}`}`
    } catch {
      return r
    }
  }, [redirectParam])

  const sendMagic = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    setSending(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo, // land back on /invite (or whatever redirect was passed)
        },
      })
      if (error) throw error
      setMsg('Check your email for the sign-in link.')
    } catch (err: any) {
      setMsg(err?.message || 'Failed to send link')
    } finally {
      setSending(false)
    }
  }, [email, emailRedirectTo])

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold mb-2">Sign in</h1>
      <p className="text-sm text-neutral-600 mb-6">
        We’ll email you a secure sign-in link.
      </p>

      <form onSubmit={sendMagic} className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm text-neutral-600">Email</span>
          <input
            type="email"
            required
            className="border rounded px-3 py-2 bg-transparent"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <button disabled={sending} className="px-4 py-2 rounded-lg border">
          {sending ? 'Sending…' : 'Send magic link'}
        </button>

        {msg && <div className="text-xs text-neutral-700">{msg}</div>}

        {!redirectParam && (
          <div className="text-[11px] text-neutral-500 mt-2">
            Tip: If you came from an invite link, we’ll send you back to your league automatically after you click the email.
          </div>
        )}
      </form>
    </main>
  )
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-4 py-10">
          <h1 className="text-2xl font-semibold mb-2">Sign in</h1>
          <div className="text-neutral-600">Loading…</div>
        </main>
      }
    >
      <AuthInner />
    </Suspense>
  )
}
