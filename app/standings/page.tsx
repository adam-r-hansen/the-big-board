'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type League = {
  id: string
  name: string
  season: number
  created_at: string
}

export default function AdminPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [name, setName] = useState('')
  const [season, setSeason] = useState(new Date().getFullYear())
  const [msg, setMsg] = useState('')
  const [busyCreate, setBusyCreate] = useState(false)
  const [joinInput, setJoinInput] = useState('')
  const [joinMsg, setJoinMsg] = useState('')
  const [busyJoin, setBusyJoin] = useState(false)

  useEffect(() => {
    loadLeagues()
  }, [])

  async function loadLeagues() {
    try {
      const res = await fetch('/api/leagues', { cache: 'no-store' })
      const j = await res.json()
      if (res.ok) {
        setLeagues(j.leagues || [])
      }
    } catch (err: any) {
      console.error('Failed to load leagues:', err)
    }
  }

  async function createLeague(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    setBusyCreate(true)
    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, season }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Create failed')
      setMsg('League created! ✅')
      setName('')
      await loadLeagues()
    } catch (err: any) {
      setMsg(err?.message || 'Create failed')
    } finally {
      setBusyCreate(false)
    }
  }

  async function joinExisting(e: React.FormEvent) {
    e.preventDefault()
    setJoinMsg('')
    setBusyJoin(true)
    try {
      let leagueId = joinInput.trim()
      if (joinInput.includes('/join?leagueId=')) {
        const url = new URL(joinInput)
        leagueId = url.searchParams.get('leagueId') || ''
      }
      if (!leagueId) throw new Error('Invalid league ID or link')

      const res = await fetch('/api/leagues/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leagueId }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Join failed')
      setJoinMsg(j.already ? 'You are already a member. ✅' : 'Joined! ✅')
      setJoinInput('')
      await loadLeagues()
    } catch (err: any) {
      setJoinMsg(err?.message || 'Join failed')
    } finally {
      setBusyJoin(false)
    }
  }

  function inviteLink(id: string) {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/join?leagueId=${id}`
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

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Admin</h1>

      {/* Quick Links Section */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5 mb-6">
        <h2 className="text-lg font-semibold mb-3">Admin Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/admin/teams"
            className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
          >
            <div className="font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">
              🎨 Team Colors
            </div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Manage light & dark mode colors for all teams
            </div>
          </Link>
          
          <Link
            href="/admin/schedule"
            className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
          >
            <div className="font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">
              📅 Global Schedule
            </div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Sync schedule from ESPN
            </div>
          </Link>

          <Link
            href="/admin/invites"
            className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
          >
            <div className="font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">
              ✉️ Invites
            </div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Manage league invitations
            </div>
          </Link>
        </div>
      </section>

      {/* Create a league */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5 mb-6">
        <h2 className="text-lg font-semibold mb-3">Create a league</h2>
        <form onSubmit={createLeague} className="grid gap-3 max-w-xl">
          <label className="grid gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Name</span>
            <input
              className="border rounded px-3 py-2 bg-transparent dark:border-neutral-700"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="2025 Big Board"
              required
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Season</span>
            <input
              type="number"
              className="border rounded px-3 py-2 bg-transparent dark:border-neutral-700"
              value={season}
              onChange={(e) => setSeason(Number(e.target.value))}
              min={2000}
              max={3000}
              required
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              disabled={busyCreate}
              className="px-4 py-2 rounded-lg border dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
            >
              {busyCreate ? 'Creating…' : 'Create league'}
            </button>
            {msg && <span className="text-sm">{msg}</span>}
          </div>
        </form>
      </section>

      {/* Join a league */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5 mb-6">
        <h2 className="text-lg font-semibold mb-3">Join a league</h2>
        <form onSubmit={joinExisting} className="flex flex-col sm:flex-row gap-3 max-w-xl">
          <input
            className="border rounded px-3 py-2 bg-transparent dark:border-neutral-700 flex-1"
            placeholder="Paste invite link or league id…"
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
          />
          <button
            disabled={busyJoin}
            className="px-4 py-2 rounded-lg border dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
          >
            {busyJoin ? 'Joining…' : 'Join'}
          </button>
        </form>
        {joinMsg && <p className="text-sm mt-2">{joinMsg}</p>}
      </section>

      {/* Your leagues */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
        <h2 className="text-lg font-semibold mb-3">Your leagues</h2>
        {leagues.length === 0 ? (
          <div className="text-sm text-neutral-500 dark:text-neutral-400">No leagues yet</div>
        ) : (
          <ul className="grid gap-2">
            {leagues.map((league) => (
              <li
                key={league.id}
                className="flex items-center justify-between border rounded-lg px-3 py-2 dark:border-neutral-700"
              >
                <div>
                  <Link
                    href={`/admin/leagues/${league.id}`}
                    className="font-semibold hover:underline"
                  >
                    {league.name}
                  </Link>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    Season {league.season}
                  </div>
                </div>
                <button
                  onClick={() => copyLink(league.id)}
                  className="text-xs px-2 py-1 rounded border dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  Copy invite link
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
