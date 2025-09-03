// app/admin/page.tsx
'use client'
import { useEffect, useState } from 'react'

type League = { id: string; name: string; season: number }

export default function AdminPage() {
  const [name, setName] = useState('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [msg, setMsg] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [leagues, setLeagues] = useState<League[]>([])
  const [copyMsg, setCopyMsg] = useState<string>('')

  async function loadLeagues() {
    try {
      const j = await fetch('/api/my-leagues', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))
      setLeagues(j?.leagues || [])
    } catch {}
  }
  useEffect(() => { loadLeagues() }, [])

  async function createLeague(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    setBusy(true)
    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, season }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`)
      setMsg('League created ✅')
      setName('')
      await loadLeagues()
    } catch (err: any) {
      setMsg(err?.message || 'Failed to create league')
    } finally {
      setBusy(false)
    }
  }

  function inviteLink(id: string) {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/join?leagueId=${id}`
  }

  async function copyLink(id: string) {
    try {
      const link = inviteLink(id)
      await navigator.clipboard.writeText(link)
      setCopyMsg('Invite link copied!')
      setTimeout(() => setCopyMsg(''), 1500)
    } catch {
      setCopyMsg('Copy failed')
      setTimeout(() => setCopyMsg(''), 2000)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Admin</h1>

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5 mb-6">
        <h2 className="text-lg font-semibold mb-3">Create a league</h2>
        <form onSubmit={createLeague} className="grid gap-3 max-w-md">
          <label className="grid gap-1">
            <span className="text-sm text-neutral-600">Name</span>
            <input className="border rounded px-3 py-2 bg-transparent" value={name} onChange={e => setName(e.target.value)} placeholder="2025 Big Board" required />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-neutral-600">Season</span>
            <input type="number" className="border rounded px-3 py-2 bg-transparent" value={season} onChange={e => setSeason(Number(e.target.value))} min={2000} max={3000} required />
          </label>
          <div className="flex items-center gap-3">
            <button disabled={busy} className="px-4 py-2 rounded-lg border">{busy ? 'Creating…' : 'Create league'}</button>
            {msg && <span className="text-sm">{msg}</span>}
          </div>
        </form>
      </section>

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
        {copyMsg && <div className="text-xs mt-2">{copyMsg}</div>}
      </section>
    </main>
  )
}
