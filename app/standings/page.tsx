// app/standings/page.tsx
'use client'

import { useEffect, useState } from 'react'

function fmtPts(n: number) {
  const s = n.toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>
  if (rank === 2) return <span className="text-lg">🥈</span>
  if (rank === 3) return <span className="text-lg">🥉</span>
  return <span className="font-medium text-neutral-600 dark:text-neutral-400">{rank}</span>
}

type Row = {
  profile_id: string
  display_name: string
  preferred_color: string | null
  points: number
  correct: number
  longest_streak: number
  wrinkle_points: number
  rank: number
  back_from_first: number
  back_to_playoffs: number
}

type League = { id: string; name: string; season: number }

export default function StandingsPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<Row[]>([])
  const [leagueName, setLeagueName] = useState('—')
  const [startWeek, setStartWeek] = useState(1)
  const [loading, setLoading] = useState(false)

  const isPlayoffLeague = startWeek === 1

  // Load leagues
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/my-leagues', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          const L: League[] = Array.isArray(data?.leagues) ? data.leagues : data?.rows || data || []
          setLeagues(L)
          if (L.length > 0 && !leagueId) {
            setLeagueId(L[0].id)
            setSeason(L[0].season || new Date().getFullYear())
          }
        }
      } catch (e) {
        console.error('Failed to load leagues:', e)
      }
    })()
  }, [])

  // Load standings when league/season changes
  useEffect(() => {
    if (!leagueId) return
    
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch(
          `/api/standings?leagueId=${encodeURIComponent(leagueId)}&season=${season}`,
          { cache: 'no-store' }
        )
        if (res.ok) {
          const data = await res.json()
          setRows(data.rows || [])
          setLeagueName(data.leagueName || '—')
          setStartWeek(data.startWeek ?? 1)
        }
      } catch (e) {
        console.error('Failed to load standings:', e)
        setRows([])
      } finally {
        setLoading(false)
      }
    })()
  }, [leagueId, season])

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Standings</h1>
        <div className="text-lg text-neutral-500">
          League: <span className="font-medium text-neutral-800 dark:text-neutral-200">{leagueName}</span>
        </div>
      </div>

      {/* League/Season selectors - only show if multiple leagues */}
      {leagues.length > 1 && (
        <section className="mb-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">League</label>
            <select
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2"
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
            >
              {leagues.map((L) => (
                <option key={L.id} value={L.id}>
                  {L.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Season</label>
            <input
              type="number"
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2"
              value={season}
              onChange={(e) => setSeason(Number(e.target.value))}
            />
          </div>
        </section>
      )}

      {/* Standings table */}
      <section className="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Overall standings</h2>
          {isPlayoffLeague && (
            <div className="text-sm text-neutral-500">Top 4 advance to playoffs</div>
          )}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 text-neutral-600 dark:text-neutral-400 text-center">
            Loading standings...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 text-neutral-600 dark:text-neutral-400 text-center">
            {leagueId ? 'No standings data yet.' : 'Please join a league to view standings.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate" style={{ borderSpacing: '0 8px' }}>
              <thead>
                <tr className="text-left text-neutral-600 dark:text-neutral-400 text-sm">
                  <th className="w-16 pb-2 pr-3">Rank</th>
                  <th className="pb-2 pr-3">Member</th>
                  <th className="w-24 pb-2 pr-3 text-right">Points</th>
                  <th className="w-24 pb-2 pr-3 text-right">Correct</th>
                  <th className="w-28 pb-2 pr-3 text-right">Behind</th>
                  {isPlayoffLeague && (
                    <th className="w-32 pb-2 text-right">To 4th</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const borderColor = r.preferred_color || '#6b7280'
                  const isPlayoffSpot = isPlayoffLeague && r.rank <= 4
                  return (
                    <tr
                      key={r.profile_id}
                      className={`rounded-xl transition-colors ${
                        isPlayoffSpot 
                          ? 'bg-green-50/50 dark:bg-green-950/20' 
                          : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                      }`}
                      style={{
                        borderLeft: `4px solid ${borderColor}`,
                      }}
                    >
                      <td className="py-3 pl-3 pr-3 rounded-l-xl">
                        <RankBadge rank={r.rank} />
                      </td>
                      <td className="py-3 pr-3 font-medium">{r.display_name || '—'}</td>
                      <td className="py-3 pr-3 text-right font-semibold text-lg">{fmtPts(r.points)}</td>
                      <td className="py-3 pr-3 text-right text-neutral-600 dark:text-neutral-400">{r.correct}</td>
                      <td className="py-3 pr-3 text-right text-neutral-600 dark:text-neutral-400">
                        {r.back_from_first === 0 ? '—' : `-${fmtPts(r.back_from_first)}`}
                      </td>
                      {isPlayoffLeague && (
                        <td className={`py-3 pr-3 text-right rounded-r-xl ${
                          r.rank <= 4 
                            ? 'text-green-600 dark:text-green-400 font-medium' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {r.back_to_playoffs === 0 ? '✓ In' : `-${fmtPts(r.back_to_playoffs)}`}
                        </td>
                      )}
                      {!isPlayoffLeague && <td className="rounded-r-xl"></td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
