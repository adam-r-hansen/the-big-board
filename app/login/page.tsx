// app/login/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Tab = 'magic' | 'password'

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('magic')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=/`,
      },
    })
    
    setLoading(false)
    if (error) setErr(error.message)
    else setSent(true)
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)
    if (error) {
      setErr('Oops! Email or password is incorrect')
    } else {
      router.push('/')
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <h1 className="text-2xl font-semibold mb-6">Login to Big Board</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-neutral-200 dark:border-neutral-700">
          <button
            type="button"
            onClick={() => {
              setTab('magic')
              setErr(null)
              setSent(false)
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'magic'
                ? 'border-b-2 border-black dark:border-white text-black dark:text-white'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            Magic Link
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('password')
              setErr(null)
              setSent(false)
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'password'
                ? 'border-b-2 border-black dark:border-white text-black dark:text-white'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            Password
          </button>
        </div>

        {/* Magic Link Form */}
        {tab === 'magic' && (
          <form onSubmit={sendMagicLink} className="space-y-4">
            <div>
              <label htmlFor="magic-email" className="block text-sm font-medium mb-1">
                📧 Email Address
              </label>
              <input
                id="magic-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-black dark:bg-white text-white dark:text-black px-4 py-2 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send Magic Link'}
            </button>

            {sent && (
              <p className="text-green-600 dark:text-green-400 text-sm">
                Check your email for the login link!
              </p>
            )}
            {err && (
              <p className="text-red-600 dark:text-red-400 text-sm">{err}</p>
            )}
          </form>
        )}

        {/* Password Form */}
        {tab === 'password' && (
          <form onSubmit={signInWithPassword} className="space-y-4">
            <div>
              <label htmlFor="password-email" className="block text-sm font-medium mb-1">
                📧 Email Address
              </label>
              <input
                id="password-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                🔒 Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-black dark:bg-white text-white dark:text-black px-4 py-2 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>

            {err && (
              <p className="text-red-600 dark:text-red-400 text-sm">{err}</p>
            )}

            <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
              Forgot password? Use the Magic Link tab instead.
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
