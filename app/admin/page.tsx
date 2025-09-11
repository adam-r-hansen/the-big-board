// app/admin/page.tsx
'use client'
import { useEffect, useState } from 'react'

type League = { id: string; name: string; season: number }
type AllowedEmail = { email: string; created_at?: string }

export default function AdminPage() {
  const [name, setName] = useState('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [msg, setMsg] = useState<string>('')

  const [leagues, setLeagues] = useState<League[]>([])
  const [busyCreate, setBusyCreate] = useState(false)

  // Invite manager state
  const [emails, setEmails] = useState<AllowedEmail[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [busyInvites, setBusyInvites] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  function inviteLink(id: string) {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/join/${id}`
  }
  async function copyLink(id: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(id))
      setMsg('Invite link copied!')
      setTimeout(() => setMsg(''), 1500)
    } catch {
      setMsg('Copy failed')
      setTimeout(() => setMsg(''), 2000)
    }
  }

  async function loadLeagues() {
    try {
      const j = await fetch('/api/my-leagues', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))
      setLeagues(j?.leagues || [])
    } catch {}
  }

  async function loadInvites() {
    setBusyInvites(true)
    setInviteMsg('')
    try {
      const r = await fetch('/api/admin/invites', { cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`)
      setEmails(Array.isArray(j.emails) ? j.emails : [])
    } catch (e: any) {
      setInviteMsg(e?.message || 'Failed to load invites')
    } finally {
      setBusyInvites(false)
    }
  }

  useEffect(() => {
    loadLeagues()
    loadInvites()
  }, [])

  async function createLeague(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    setBusyCreate(true)
    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), season }),
        cache: 'no-store',
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`)
      setName('')
      setMsg('League created ✅')
      await loadLeagues()
    } catch (err: any) {
      setMsg(err?.message || 'Failed to create league')
    } finally {
      setBusyCreate(false)
    }
  }

  async function addInvite(e: React.FormEvent) {
    e.preventDefault()
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    setInviteMsg('')
    setBusyInvites(true)
    try {
      const r = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
        cache: 'no-store',
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`)
      setNewEmail('')
      await loadInvites()
      setInviteMsg('Added ✅')
      setTimeout(() => setInviteMsg(''), 1200)
    } catch (e: any) {
      setInviteMsg(e?.message || 'Add failed')
    } finally {
      setBusyInvites(false)
    }
  }

  async function removeInvite(email: string) {
    setInviteMsg('')
    setBusyInvites(true)
    try {
      const r = await fetch(`/api/admin/invites?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
        cache: 'no-store',
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`)
      await loadInvites()
      setInviteMsg('Removed ✅')
      setTimeout(() => setInviteMsg(''), 1200)
    } catch (e: any) {
      setInviteMsg(e?.message || 'Remove failed')
    } finally {
      setBusyInvites(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Admin</h1>

      {/* Invite Manager */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5 mb-6">
        <h2 className="text-lg font-semibold mb-3">Invite Manager (Allow-List)</h2>
        <form onSubmit={addInvite} className="flex flex-col sm:flex-row gap-3 max-w-xl">
          <input
            className="border rounded px-3 py-2 bg-transparent flex-1"
            placeholder="friend@example.com"
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            required
          />
          <button disabled={busyInvites} className="px-4 py-2 rounded-lg border">
            {busyInvites ? 'Saving…' : 'Add'}
          </button>
        </form>
        {inviteMsg && <div className="text-xs mt-2">{inviteMsg}</div>}

        <div className="mt-4">
          {busyInvites && emails.length === 0 ? (
            <div className="text-sm text-neutral-500">Loading…</div>
          ) : emails.length === 0 ? (
            <div className="text-sm text-neutral-500">No invited emails yet.</div>
          ) : (
            <ul className="grid gap-2">
              {emails.map((e) => (
                <li key={e.email} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <span className="text-sm">{e.email}</span>
                  <button className="text-xs underline" onClick={() => removeInvite(e.email)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Create a league */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5 mb-6">
        <h2 className="text-lg font-semibold mb-3">Create a league</h2>
        <form onSubmit={createLeague} className="grid gap-3 max-w-xl">
          <label className="grid gap-1">
            <span className="text-sm text-neutral-600">Name</span>
            <input
              className="border rounded px-3 py-2 bg-transparent"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="2025 Big Board"
              required
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-neutral-600">Season</span>
            <input
              type="number"
              className="border rounded px-3 py-2 bg-transparent"
              value={season}
              onChange={e => setSeason(Number(e.target.value))}
              min={2000}
              max={3000}
              required
            />
          </label>
          <div className="flex items-center gap-3">
            <button disabled={busyCreate} className="px-4 py-2 rounded-lg border">
              {busyCreate ? 'Creating…' : 'Create league'}
            </button>
            {msg && <span className="text-sm">{msg}</span>}
          </div>
        </form>
      </section>

      {/* Your leagues */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
        <h2 className="text-lg font-semibold mb-3">Your leagues</h2>
        {leagues.length === 0 ? (
          <div className="text-sm text-neutral-500">No leagues yet.</div>
        ) : (
          <ul className="grid gap-2">
            {leagues.map(l => (
              <li key={l.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                <span>{l.name} • {l.season}</span>
                <div className="flex items-center gap-3">
                  <a className="underline text-sm" href="/picks">Picks</a>
                  <a className="underline text-sm" href="/standings">Standings</a>
                  <button className="text-sm underline" onClick={() => copyLink(l.id)}>Copy invite link</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
