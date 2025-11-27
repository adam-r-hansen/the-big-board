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

  // Password management state
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordMode, setPasswordMode] = useState<'set' | 'change'>('set')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

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

  function handleAddPassword() {
    setPasswordMode('set')
    setShowPasswordForm(true)
    setPasswordError(null)
    setPasswordSuccess(null)
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  function handleChangePassword() {
    setPasswordMode('change')
    setShowPasswordForm(true)
    setPasswordError(null)
    setPasswordSuccess(null)
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  function handleCancelPassword() {
    setShowPasswordForm(false)
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError(null)
    setPasswordSuccess(null)
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordSaving(true)
    setPasswordError(null)
    setPasswordSuccess(null)

    // Validation
    if (newPassword !== confirmPassword) {
      setPasswordError('Oops! Passwords don\'t match')
      setPasswordSaving(false)
      return
    }

    try {
      const body: any = { newPassword }
      if (passwordMode === 'change') {
        body.oldPassword = oldPassword
      }

      const res = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json().catch(() => ({}))
      
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to set password')
      }

      setPasswordSuccess(data.message || 'Password updated!')
      setShowPasswordForm(false)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      
      // After setting password for first time, switch to "change" mode for next time
      if (passwordMode === 'set') {
        setPasswordMode('change')
      }
    } catch (e: any) {
      setPasswordError(e?.message || 'Failed to set password')
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Manage your account settings and display name.
      </p>

      <div className="mt-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        {loading ? (
          <p>Loading…</p>
        ) : error ? (
          <div className="text-red-600 dark:text-red-400">{error}</div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium">Email</label>
              <div className="mt-1 text-neutral-700 dark:text-neutral-300">
                {profile?.email || '—'}
              </div>
            </div>

            {/* Sign-In Methods Section */}
            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6">
              <h2 className="text-lg font-semibold mb-4">🔐 Sign-In Methods</h2>
              
              {!showPasswordForm && (
                <div className="space-y-3">
                  <div className="text-sm">
                    <p className="text-neutral-600 dark:text-neutral-400 mb-2">
                      Current methods:
                    </p>
                    <div className="space-y-1">
                      <p className="text-neutral-900 dark:text-neutral-100">✅ Magic Link enabled</p>
                      {passwordMode === 'change' && (
                        <p className="text-neutral-900 dark:text-neutral-100">✅ Password enabled</p>
                      )}
                    </div>
                  </div>

                  {passwordMode === 'set' ? (
                    <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
                      <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-3">
                        Having trouble with magic links? Add a password for direct sign-in.
                      </p>
                      <button
                        type="button"
                        onClick={handleAddPassword}
                        className="rounded-xl bg-black dark:bg-white text-white dark:text-black px-4 py-2 text-sm hover:opacity-90"
                      >
                        + Add Password Sign-In
                      </button>
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={handleChangePassword}
                        className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 underline"
                      >
                        Change Password
                      </button>
                    </div>
                  )}

                  {passwordSuccess && (
                    <p className="text-green-600 dark:text-green-400 text-sm">{passwordSuccess}</p>
                  )}
                </div>
              )}

              {showPasswordForm && (
                <form onSubmit={handlePasswordSubmit} className="space-y-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
                  <p className="text-sm font-medium">
                    {passwordMode === 'set' ? 'Set a password for your account' : 'Change your password'}
                  </p>

                  {passwordMode === 'change' && (
                    <div>
                      <label htmlFor="oldPassword" className="block text-sm font-medium mb-1">
                        Old Password
                      </label>
                      <input
                        id="oldPassword"
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        required
                        className="w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium mb-1">
                      New Password
                    </label>
                    <input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
                    />
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      At least 6 characters with letters and numbers
                    </p>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
                      Confirm Password
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
                    />
                  </div>

                  {passwordError && (
                    <p className="text-red-600 dark:text-red-400 text-sm">{passwordError}</p>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={passwordSaving}
                      className="rounded-xl bg-black dark:bg-white text-white dark:text-black px-4 py-2 disabled:opacity-50"
                    >
                      {passwordSaving ? 'Saving…' : passwordMode === 'set' ? 'Set Password' : 'Update Password'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelPassword}
                      className="rounded-xl border border-neutral-300 dark:border-neutral-600 px-4 py-2"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Display Name */}
            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6">
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
                className="mt-1 w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                2–40 characters. Used in standings and league views.
              </p>
            </div>

            {/* Save Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving || displayName.trim().length < 2}
                className="rounded-xl bg-black dark:bg-white text-white dark:text-black px-4 py-2 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <Link
                href="/"
                className="rounded-xl border border-neutral-300 dark:border-neutral-600 px-4 py-2"
              >
                Back home
              </Link>
              {ok && <span className="text-green-600 dark:text-green-400">Saved!</span>}
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
