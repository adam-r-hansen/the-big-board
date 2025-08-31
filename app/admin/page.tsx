'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type League = { id: string; name: string; season: number }

export default function AdminPage() {
  const [isOwner, setIsOwner] = useState(false)
  const [leagues, setLeagues] = useState<League[]>([])
  const [name, setName] = useState('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string>('')

  async function loadIsOwner() {
    try {
      const res = await fetch('/api/admin/is-site-owner', { cache: 'no-store' })
      const j = await res.json().catch(() => ({}))
      setIsOwner(!!j?.isOwner)
    } catch {
      setIsOwner(false)
    }
  }

  async function loadLeagues() {
    setMsg('')
    try {
      // Lists leagues you belong to (used elsewhere in the app)
      const res = await fetch('/api/my-leagues', { cache: 'no-store' })
      const j = await res.json().catch(() => ({}))
      setLeagues(Array.isArray(j?.leagues) ? j.leagues : [])
    } catch (e) {
      setMsg('Failed to load leagues')
    }
  }

  async function createLeague() {
    setMsg('')
    if (!name.trim()) { setMsg('Enter a league name'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), season })
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j?.ok) {
        setMsg(j?.error || 'Create failed')
        return
      }
      setName('')
      await loadLeagues()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadIsOwner(); loadLeagues() }, [])

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 grid gap-6">
      <h1 className="text-4xl font-extrabold tracking-tight">Admin</h1>

      {isOwner && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 flex items-center justify-between bg-white dark:bg-neutral-900">
          <div>
            <div className="font-semibold">Global Schedule</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              Sync regular-season games from ESPN across all leagues.
            </div>
          </div>
          <Link
            href="/admin/schedule"
            className="px-3 py-1.5 rounded-md border hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Open
          </Link>
        </div>
      )}

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 grid gap-4">
        <h2 className="text-xl font-semibold">Create a League</h2>
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <input
            className="flex-1 h-10 rounded-md border px-3"
            placeholder="League name"
            value={name}
            onChange={e=>setName(e.target.value)}
          />
          <label className="text-sm">
            Season
            <input
              className="ml-2 h-10 w-28 rounded-md border px-2"
              type="number"
              value={season}
              onChange={e=>setSeason(+e.target.value)}
            />
          </label>
          <button
            className="h-10 px-4 rounded-md bg-black text-white disabled:opacity-60"
            disabled={loading || !name.trim()}
            onClick={createLeague}
          >
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 grid gap-4">
        <h2 className="text-xl font-semibold">Your Leagues</h2>
        {leagues.length === 0 ? (
          <div className="text-sm text-neutral-600">No leagues yet.</div>
        ) : (
          <ul className="grid gap-2">
            {leagues.map(l => (
              <li key={l.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                <span>{l.name} — {l.season}</span>
                <Link href={`/admin/leagues/${l.id}`} className="text-sm underline">Manage</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
