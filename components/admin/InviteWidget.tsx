'use client'

import { useEffect, useMemo, useState } from 'react'

type League = { id: string; name: string; season: number; role?: string }
type Invite = {
  token: string
  league_id: string
  email: string | null
  role: 'admin' | 'member'
  created_at: string
  expires_at: string | null
  used_by: string | null
  used_at: string | null
}

export default function InviteWidget() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin'|'member'>('member')
  const [invites, setInvites] = useState<Invite[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>('')

  // Load leagues I can admin/own
  useEffect(() => {
    ;(async () => {
      setError('')
      try {
        const res = await fetch('/api/my-leagues', { cache: 'no-store' })
        const j = await res.json()
        const list: League[] = (j.admin ?? j.adminLeagues ?? j.leagues ?? []) as League[]
        // If roles are present, keep only owner/admin
        const filtered = list.filter(l => !l.role || ['owner', 'admin'].includes(l.role.toLowerCase()))
        setLeagues(filtered)
        if (!leagueId && filtered.length > 0) setLeagueId(filtered[0].id)
      } catch (e) {
        setError('Failed to load your leagues')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load invites whenever league changes
  useEffect(() => {
    if (!leagueId) return
    refreshInvites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId])

  async function refreshInvites() {
    try {
      setBusy(true)
      setError('')
      const res = await fetch(`/api/leagues/${leagueId}/invites`, { cache: 'no-store' })
      if (!res.ok) throw new Error('load failure')
      const j = await res.json()
      setInvites(j.invites ?? [])
    } catch {
      setError('Failed to load invites')
    } finally {
      setBusy(false)
    }
  }

  async function createInvite() {
    try {
      setBusy(true)
      setError('')
      const res = await fetch(`/api/leagues/${leagueId}/invites`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() || null, role }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'create failure')
      setEmail('')
      await refreshInvites()
    } catch (e: any) {
      setError(e?.message || 'Failed to create invite')
    } finally {
      setBusy(false)
    }
  }

  async function revokeInvite(token: string) {
    try {
      setBusy(true)
      setError('')
      const res = await fetch(`/api/leagues/${leagueId}/invites?token=${encodeURIComponent(token)}`, {
        method: 'DELETE',
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'delete failure')
      await refreshInvites()
    } catch (e: any) {
      setError(e?.message || 'Failed to revoke invite')
    } finally {
      setBusy(false)
    }
  }

  const joinBase = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || '')

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">League
          <select
            className="ml-2 h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
            value={leagueId}
            onChange={(e)=>setLeagueId(e.target.value)}
          >
            {leagues.map(l => (
              <option key={l.id} value={l.id}>
                {l.name} — Season {l.season}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">Email (optional)
          <input
            className="ml-2 h-9 w-64 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
            placeholder="person@example.com"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
          />
        </label>

        <label className="text-sm">Role
          <select
            className="ml-2 h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
            value={role}
            onChange={(e)=>setRole(e.target.value as any)}
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
        </label>

        <button
          type="button"
          disabled={!leagueId || busy}
          onClick={createInvite}
          className="ml-auto h-9 rounded-md px-3 font-medium bg-black text-white disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Create invite'}
        </button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div>
        <h3 className="text-sm font-semibold mb-2">Active invites</h3>
        {invites.length === 0 ? (
          <div className="text-sm text-neutral-500">No invites yet.</div>
        ) : (
          <ul className="grid gap-2">
            {invites.map(inv => {
              const used = !!inv.used_at
              const url = `${joinBase}/invite/${inv.token}`
              return (
                <li key={inv.token} className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2">
                  <div className="text-sm">
                    <div className="font-medium">{inv.role.toUpperCase()} invite{inv.email ? ` • ${inv.email}` : ''}</div>
                    <div className="text-neutral-500 text-xs">
                      Link: <a className="underline" href={url} target="_blank" rel="noreferrer">{url}</a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {used ? (
                      <span className="text-xs text-neutral-500">Used</span>
                    ) : (
                      <button
                        type="button"
                        className="text-xs underline disabled:opacity-50"
                        onClick={()=> revokeInvite(inv.token)}
                        disabled={busy}
                        title="Revoke"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
