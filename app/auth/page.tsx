// app/auth/page.tsx
'use client'

import { useCallback, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

export default function AuthPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  // Carry a redirect back to where we want (usually /invite?leagueId=...)
  const redirectParam = sp.get('redirect') || ''
  const emailRedirectTo = useMemo(() => {
    // If redirect is absolute, use as-is; otherwise prefix with origin
    const r = redirectParam || '/'
    try {
      // SSR-safe: window may be undefined in theory,
      // but this is a client component so it's fine.
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
          emailRedirectTo, // <- critical: this lands them back on /invite
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

        {/* Helpful: if user navigated here without redirect, explain */}
        {!redirectParam && (
          <div className="text-[11px] text-neutral-500 mt-2">
            Tip: If you came from an invite link, we’ll send you back to your league automatically after you click the email.
          </div>
        )}
      </form>
    </main>
  )
}
