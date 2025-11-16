'use client'

import { createBrowserSupabaseClient } from '@/lib/supabase-clients'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    const supabase = createBrowserSupabaseClient()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8">
        <div>
          <h1 className="text-2xl font-bold">Sign in to NFL Pick'em</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            We'll send you a magic link to sign in
          </p>
        </div>

        {success ? (
          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4 text-green-800 dark:text-green-200">
            <p className="font-semibold">Check your email!</p>
            <p className="text-sm mt-1">
              We sent a magic link to <strong>{email}</strong>. Click the link to sign in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Sending link...' : 'Send magic link'}
            </button>
          </form>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-red-800 dark:text-red-200">
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
