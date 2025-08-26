'use client'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
      emailRedirectTo: `${location.origin}/auth/callback?next=/`,
      },
    })
    if (error) setErr(error.message)
    else setSent(true)
  }

  return (
    <main style={{maxWidth:420, margin:'48px auto', display:'grid', gap:12}}>
      <h1 style={{fontWeight:700}}>Login</h1>
      <form onSubmit={sendMagicLink} style={{display:'grid', gap:8}}>
        <input
          type="email"
          value={email}
          onChange={e=>setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          style={{border:'1px solid #ccc', padding:'.5rem'}}
        />
        <button type="submit" style={{border:'1px solid #ccc', padding:'.5rem'}}>Send Magic Link</button>
      </form>
      {sent && <p>Check your email for the login link.</p>}
      {err && <p style={{color:'crimson'}}>{err}</p>}
    </main>
  )
}
