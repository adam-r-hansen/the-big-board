'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type League = { id: string; name: string; season: number }

type Row = {
  profile_id: string
  display_name: string
  points: number
  correct: number
  longest_streak: number
  wrinkle_points: number
  rank: number
  back_from_first: number
  back_to_playoffs: number
}

function fmtPts(n: number) {
  const s = n.toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

export default function StandingsPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number | null>(null) // null = overall
  const [rows, setRows] = useState<Row[]>([])
  const [leagueName, setLeagueName] = useState('—')
  const [loading, setLoading] = useState(false)

  // Load leagues on mount
  useEffect(() => {
    fetch('/api/my-leagues', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const ls: League[] = j.leagues || []
        setLeagues(ls)
        if (ls.length === 1) {
          setLeagueId(ls[0].id)
          setSeason(ls[0].season)
        } else if (ls.length > 0) {
          setLeagueId(ls[0].id)
          setSeason(ls[0].season)
        }
      })
      .catch(() => {})
  }, [])

  // Load standings when leagueId, season, or week changes
  useEffect(() => {
    if (!leagueId || !season) return
    setLoading(true)
    const qs = new URLSearchParams({ leagueId, season: String(season) })
    if (week !== null) qs.set('week', String(week))

    fetch(`/api/standings?${qs.toString()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        setRows(data.rows || [])
        setLeagueName(data.leagueName || '—')
      })
      .catch(() => {
        setRows([])
        setLeagueName('—')
      })
      .finally(() => setLoading(false))
  }, [leagueId, season, week])

  const noLeagues = leagues.length === 0
  const singleLeague = leagues.length === 1

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Header with controls */}
      <section className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">Standings</h1>

        <div className="ml-auto flex items-center gap-3">
          <Link className="underline text-sm" href="/">
            Home
          </Link>
          <Link className="underline text-sm" href="/picks">
            Picks
          </Link>

          {/* League selector (if multiple leagues) */}
          {!noLeagues && !singleLeague && (
            <select
              className="border rounded px-2 py-1 bg-transparent"
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
            >
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {l.season}
                </option>
              ))}
            </select>
          )}

          {/* Season selector */}
          <select
            className="border rounded px-2 py-1 bg-transparent"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
          >
            {Array.from({ length: 3 }).map((_, i) => {
              const yr = new Date().getFullYear() - 1 + i
              return (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              )
            })}
          </select>

          {/* Week selector (with "Overall" option) */}
          <select
            className="border rounded px-2 py-1 bg-transparent"
            value={week === null ? 'overall' : week}
            onChange={(e) => {
              const val = e.target.value
              setWeek(val === 'overall' ? null : Number(val))
            }}
          >
            <option value="overall">Overall</option>
            {Array.from({ length: 18 }).map((_, i) => {
              const wk = i + 1
              return (
                <option key={wk} value={wk}>
                  Week {wk}
                </option>
              )
            })}
          </select>
        </div>
      </section>

      {/* League name display (if single league) */}
      {singleLeague && (
        <div className="mb-4 text-lg text-neutral-500">
          League: <span className="font-medium text-neutral-800 dark:text-neutral-200">{leagues[0].name}</span>
        </div>
      )}

      {/* Standings table */}
      <section className="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {week === null ? 'Overall Standings' : `Week ${week} Standings`}
          </h2>
          <div className="text-sm text-neutral-500">Top 4 advance to playoffs</div>
        </div>

        {loading ? (
          <div className="text-neutral-500">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 text-neutral-600">
            {noLeagues ? 'Join a league to see standings.' : 'No standings data yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate" style={{ borderSpacing: 0 }}>
              <thead>
                <tr className="text-left text-neutral-600 dark:text-neutral-400">
                  <th className="w-12 border-b border-neutral-300 dark:border-neutral-700 py-2 pr-3">#</th>
                  <th className="border-b border-neutral-300 dark:border-neutral-700 py-2 pr-3">Member</th>
                  <th className="w-24 border-b border-neutral-300 dark:border-neutral-700 py-2 text-right">Pts</th>
                  <th className="w-24 border-b border-neutral-300 dark:border-neutral-700 py-2 text-right">Correct</th>
                  <th className="w-28 border-b border-neutral-300 dark:border-neutral-700 py-2 text-right">Back</th>
                  <th className="w-32 border-b border-neutral-300 dark:border-neutral-700 py-2 text-right">Back to 4th</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.profile_id}
                    className="border-b border-neutral-200 dark:border-neutral-800 last:border-b-0"
                  >
                    <td className="py-3 pr-3">{r.rank}</td>
                    <td className="py-3 pr-3">{r.display_name || '—'}</td>
                    <td className="py-3 text-right font-medium">{fmtPts(r.points)}</td>
                    <td className="py-3 text-right">{r.correct}</td>
                    <td className="py-3 text-right">{fmtPts(r.back_from_first)}</td>
                    <td className="py-3 text-right">{fmtPts(r.back_to_playoffs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
