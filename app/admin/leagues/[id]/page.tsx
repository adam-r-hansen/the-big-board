'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type League = {
  id: string
  name: string
  season: number
  start_week: number
}

export default function LeagueAdminPage({ params }: { params: { id: string } }) {
  const [id, setId] = useState<string>('')
  const [league, setLeague] = useState<League | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState(1)

  useEffect(() => {
    // Unwrap params for Next.js 15
    Promise.resolve(params).then((p) => {
      setId(p.id)
    })
  }, [params])

  useEffect(() => {
    if (id) loadLeague()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadLeague() {
    try {
      const res = await fetch(`/api/leagues/${id}`, { cache: 'no-store' })
      const j = await res.json()
      if (res.ok && j.league) {
        setLeague(j.league)
        setSelectedWeek(j.league.start_week || 1)
      } else {
        setMsg('League not found')
      }
    } catch (err: any) {
      setMsg(err?.message || 'Failed to load league')
    } finally {
      setLoading(false)
    }
  }

  async function refreshTeamRecords() {
    if (!league) return
    
    setRefreshing(true)
    setMsg('')
    
    try {
      const res = await fetch('/api/team-records/calculate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 
          season: league.season, 
          week: selectedWeek 
        }),
      })
      
      const j = await res.json()
      
      if (!res.ok) {
        throw new Error(j?.error || 'Failed to refresh team records')
      }
      
      setMsg(`✅ Team records calculated for Week ${selectedWeek}`)
      setTimeout(() => setMsg(''), 3000)
    } catch (err: any) {
      setMsg(`❌ ${err?.message || 'Failed to refresh team records'}`)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="text-sm text-neutral-500">Loading...</div>
      </main>
    )
  }

  if (!league) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="text-sm text-neutral-500">{msg || 'League not found'}</div>
        <Link href="/admin" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
          ← Back to Admin
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
          ← Back to Admin
        </Link>
        <h1 className="text-2xl font-bold">{league.name}</h1>
        <div className="text-sm text-neutral-600 dark:text-neutral-400">
          Season {league.season}
        </div>
      </div>

      {/* Team Records Section */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5 mb-6">
        <h2 className="text-lg font-semibold mb-3">Team Records Calculator</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          Calculate team win/loss records entering each week. This is needed for Winless Double and OOF wrinkles.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <label className="grid gap-1 flex-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              Calculate records entering week:
            </span>
            <select
              className="border rounded px-3 py-2 bg-transparent dark:border-neutral-700"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
            >
              {Array.from({ length: 18 }).map((_, i) => {
                const wk = i + 1
                return (
                  <option key={wk} value={wk}>
                    Week {wk}
                  </option>
                )
              })}
            </select>
          </label>
          
          <button
            onClick={refreshTeamRecords}
            disabled={refreshing}
            className="px-4 py-2 rounded-lg border dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
          >
            {refreshing ? 'Calculating...' : 'Refresh Team Records'}
          </button>
        </div>
        
        {msg && (
          <div className="mt-3 text-sm">
            {msg}
          </div>
        )}
        
        <div className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
          This calculates each team's record based on completed games before the selected week.
        </div>
      </section>

      {/* Wrinkles Section - Coming Soon */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
        <h2 className="text-lg font-semibold mb-3">Wrinkles</h2>
        <div className="text-sm text-neutral-500 dark:text-neutral-400">
          Wrinkle management coming soon...
        </div>
      </section>
    </main>
  )
}
