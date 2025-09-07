// app/stats/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import TeamPill from '@/components/ui/TeamPill'
import { buildTeamIndex, type Team as TeamType } from '@/lib/teamColors'

type Team = TeamType

type MySeason = {
  picks: number
  correct: number
  win_pct: number
  longest_streak: number
  points: number
  avg_per_pick: number
  wrinkle_points: number
  log: Array<{
    week: number
    team_id: string
    result: 'W' | 'L' | '-' | 'T'
    score: string | null   // e.g., "20-13"
    points: number | null
    wrinkle: boolean
    status?: 'LIVE' | 'FINAL' | 'UPCOMING'
  }>
}

type LeaderboardRow = {
  rank: number
  profile_id: string
  display_name: string
  decided: number
  points: number
  avg: number
  correct?: number
  accuracy?: number
}

export default function StatsPage() {
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})
  const teamIndex = useMemo(() => buildTeamIndex(teamMap), [teamMap])

  const [mine, setMine] = useState<MySeason | null>(null)
  const [lbAvg, setLbAvg] = useState<LeaderboardRow[]>([])
  const [lbAcc, setLbAcc] = useState<LeaderboardRow[]>([])
  const [msg, setMsg] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const tm = await fetch('/api/team-map', { cache: 'no-store' }).then(r => r.json())
        setTeamMap(tm?.teams || {})
      } catch {}
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      setMsg('')
      try {
        const [ms, ls] = await Promise.all([
          fetch(`/api/my-stats?season=${season}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/league-stats?season=${season}`, { cache: 'no-store' }).then(r => r.json()),
        ])

        setMine(ms?.season || null)
        setLbAvg(ls?.leaderboard_avg || [])
        setLbAcc(ls?.leaderboard_accuracy || [])
      } catch (e: any) {
        setMsg(e?.message || 'Failed to load')
      }
    })()
  }, [season])

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-bold">Stats</h1>
        <div className="ml-auto flex items-center gap-2">
          <select
            className="border rounded px-2 py-1 bg-transparent"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
          >
            {Array.from({ length: 3 }).map((_, i) => {
              const yr = new Date().getFullYear() - 1 + i
              return <option key={yr} value={yr}>{yr}</option>
            })}
          </select>
        </div>
      </header>

      {/* My Season */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <div className="rounded-2xl border p-5">
            <h2 className="text-lg font-semibold mb-3">My Season ({season})</h2>
            {!mine ? (
              <div className="text-sm text-neutral-500">No data.</div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatCard label="Picks" value={mine.picks} />
                  <StatCard label="Correct" value={mine.correct} />
                  <StatCard label="Win %" value={`${(mine.win_pct * 100).toFixed(1)}%`} />
                  <StatCard label="Longest Streak" value={mine.longest_streak} />
                  <StatCard label="Points" value={mine.points} />
                  <StatCard label="Avg / Pick" value={mine.avg_per_pick.toFixed(2)} />
                  <StatCard label="Wrinkle Points" value={mine.wrinkle_points} />
                </div>

                <h3 className="mt-5 mb-2 font-semibold">My Pick Log</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-neutral-500">
                      <tr>
                        <th className="py-2 pr-3">Week</th>
                        <th className="py-2 pr-3">Team</th>
                        <th className="py-2 pr-3">Result</th>
                        <th className="py-2 pr-3">Score</th>
                        <th className="py-2 pr-3">Points</th>
                        <th className="py-2 pr-3">Wrinkle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(mine.log || []).map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="py-2 pr-3">{r.week}</td>
                          <td className="py-2 pr-3">
                            <TeamPill
                              teamId={r.team_id}
                              teamIndex={teamIndex}
                              size="sm"
                              variant="subtle"
                              status={r.status}
                              points={r.status === 'FINAL' ? (r.points ?? null) : null}
                            />
                          </td>
                          <td className="py-2 pr-3">{r.result}</td>
                          <td className="py-2 pr-3">{r.score || '—'}</td>
                          <td className="py-2 pr-3">{typeof r.points === 'number' ? r.points : '—'}</td>
                          <td className="py-2 pr-3">{r.wrinkle ? '✓' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Leaderboards */}
        <div className="lg:col-span-7 grid gap-6">
          <Board
            title="Leaderboard — Avg Points / Pick"
            heads={['#', 'Member', 'Decided', 'Points', 'Avg/Pick']}
            rows={(lbAvg || []).map((r) => [r.rank, r.display_name, r.decided, r.points, r.avg.toFixed(2)])}
          />
          <Board
            title="Leaderboard — Pick Accuracy"
            heads={['#', 'Member', 'Correct', 'Decided', 'Accuracy']}
            rows={(lbAcc || []).map((r) => [r.rank, r.display_name, r.correct ?? '—', r.decided, `${(r.accuracy ?? 0).toFixed(1)}%`])}
          />
        </div>
      </section>

      {msg && <div className="text-xs mt-3">{msg}</div>}
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border px-4 py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  )
}

function Board({
  title, heads, rows,
}: { title: string; heads: string[]; rows: (string|number)[][] }) {
  return (
    <div className="rounded-2xl border p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-xs text-neutral-500">Finals only</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-neutral-500">
            <tr>
              {heads.map((h) => <th key={h} className="py-2 pr-3">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                {r.map((c, j) => <td key={j} className="py-2 pr-3">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
