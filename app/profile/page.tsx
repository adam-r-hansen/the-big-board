// app/profile/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Profile = {
  id: string
  email: string | null
  full_name: string | null
  display_name: string | null
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      setOk(false)
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' })
        if (res.status === 401) {
          setError('Please sign in to edit your profile.')
          return
        }
        const data = await res.json()
        if (mounted) {
          setProfile(data.profile ?? null)
          setDisplayName(data.profile?.display_name ?? '')
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setOk(false)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Save failed')
      }
      setOk(true)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Set your display name — this is shown on standings and pick lists.
      </p>

      <div className="mt-6 rounded-2xl border border-neutral-200 p-6">
        {loading ? (
          <p>Loading…</p>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium">Email</label>
              <div className="mt-1 text-neutral-700">
                {profile?.email || '—'}
              </div>
            </div>

            <div>
              <label htmlFor="displayName" className="block text-sm font-medium">
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
                placeholder="e.g., Adam H."
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
              />
              <p className="mt-1 text-xs text-neutral-500">
                2–40 characters. Used in standings and league views.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving || displayName.trim().length < 2}
                className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <Link
                href="/"
                className="rounded-xl border border-neutral-300 px-4 py-2"
              >
                Back home
              </Link>
              {ok && <span className="text-green-600">Saved!</span>}
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
