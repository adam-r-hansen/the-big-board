'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import TeamPill from '@/components/ui/TeamPill'
import { buildTeamIndex, type Team as TeamType } from '@/lib/teamColors'

type League = { id: string; name: string; season: number }
type Team = TeamType

type PickRow = {
  week?: number
  team_id?: string
  game_id?: string
  status?: 'UPCOMING' | 'LIVE' | 'FINAL'
  result?: 'W' | 'L' | 'T' | null
  score?: { home?: number; away?: number } | null
  points?: number | null
  wrinkle?: boolean | null
}

type MyStatsPayload = {
  picks_total?: number
  decided_picks?: number
  picks_correct?: number
  win_pct?: number // 0..100
  longest_streak?: number
  points_total?: number
  avg_points_per_pick?: number
  wrinkle_points?: number
  pick_log?: PickRow[]
}

type LeagueBoards = {
  avg_points?: Array<{ display_name: string; decided?: number; points?: number; avg?: number }>
  accuracy?: Array<{ display_name: string; correct?: number; decided?: number; pct?: number }>
  streaks?: Array<{ display_name: string; streak?: number }>
}

/* ------------------------ UI shell ------------------------ */

function Card({
  children,
  title,
  right,
  className = '',
}: {
  children: React.ReactNode
  title: string
  right?: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={[
        'rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5',
        className,
      ].join(' ')}
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </header>
      {children}
    </section>
  )
}

/* ------------------------ number safety ------------------------ */

const N = (v: unknown): number => {
  const x = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : NaN
}
const intStr = (v: unknown): string => (Number.isFinite(N(v)) ? String(Math.trunc(N(v))) : '—')
const fixedStr = (v: unknown, dp = 2): string => (Number.isFinite(N(v)) ? N(v).toFixed(dp) : '—')
const pctStr = (v: unknown): string => {
  let x = N(v)
  if (!Number.isFinite(x)) return '—'
  if (x <= 1) x *= 100
  return `${x.toFixed(1)}%`
}

/* ------------------------ derive + normalize ------------------------ */

function rowsToDerived(rows: PickRow[]) {
  const picks_total = rows.length
  const picks_correct = rows.reduce((acc, r) => acc + (r.result === 'W' ? 1 : 0), 0)
  const points_total = rows.reduce((acc, r) => acc + (Number.isFinite(N(r.points)) ? N(r.points) : 0), 0)

  // wrinkle points = sum of points where wrinkle=true
  const wrinkle_points = rows.reduce(
    (acc, r) => acc + (r.wrinkle && Number.isFinite(N(r.points)) ? N(r.points) : 0),
    0,
  )

  // longest consecutive W streak (order by week if present)
  let longest = 0
  let cur = 0
  const sorted = [...rows].sort((a, b) => (N(a.week) || 0) - (N(b.week) || 0))
  for (const r of sorted) {
    if (r.result === 'W') {
      cur += 1
      if (cur > longest) longest = cur
    } else if (r.result === 'L' || r.result === 'T') {
      cur = 0
    }
  }

  const avg_points_per_pick = picks_total > 0 ? points_total / picks_total : NaN
  const win_pct = picks_total > 0 ? (picks_correct / picks_total) * 100 : NaN

  return {
    picks_total,
    picks_correct,
    points_total,
    wrinkle_points,
    longest_streak: longest,
    avg_points_per_pick,
    win_pct,
  }
}

function normalizeMyStats(j: any): MyStatsPayload {
  // your shape: { ok, season, summary:{…}, log:[…] }
  const summary = j?.summary ?? j?.stats ?? {}
  const log: PickRow[] = Array.isArray(j?.log) ? j.log : Array.isArray(summary?.log) ? summary.log : []

  // prefer backend counts, derive if missing
  const derived = rowsToDerived(log)

  return {
    picks_total: Number.isFinite(N(summary.picks_total)) ? N(summary.picks_total) : derived.picks_total,
    decided_picks: Number.isFinite(N(summary.decided_picks)) ? N(summary.decided_picks) : undefined,
    picks_correct: Number.isFinite(N(summary.correct)) ? N(summary.correct) : derived.picks_correct,
    win_pct:
      Number.isFinite(N(summary.accuracy))
        ? (N(summary.accuracy) <= 1 ? N(summary.accuracy) * 100 : N(summary.accuracy))
        : derived.win_pct,
    longest_streak: Number.isFinite(N(summary.longest_streak)) ? N(summary.longest_streak) : derived.longest_streak,
    points_total: Number.isFinite(N(summary.points_total)) ? N(summary.points_total) : derived.points_total,
    avg_points_per_pick: Number.isFinite(N(summary.avg_points_per_pick))
      ? N(summary.avg_points_per_pick)
      : derived.avg_points_per_pick,
    wrinkle_points: Number.isFinite(N(summary.wrinkle_points)) ? N(summary.wrinkle_points) : derived.wrinkle_points,
    pick_log: log,
  }
}

function normalizeBoards(j: any): LeagueBoards {
  // your shape: { leaders:{ avg_points_per_pick:[…], accuracy:[…], longest_streak:[…] }, … }
  const L = j?.leaders ?? {}

  const avg_points_src = Array.isArray(L.avg_points_per_pick) ? L.avg_points_per_pick : []
  const accuracy_src = Array.isArray(L.accuracy) ? L.accuracy : []
  const streaks_src = Array.isArray(L.longest_streak) ? L.longest_streak : []

  return {
    avg_points: avg_points_src.map((r: any) => ({
      display_name: r.display_name,
      decided: N(r.decided),
      points: N(r.points_total),
      avg: N(r.avg_points_per_pick),
    })),
    accuracy: accuracy_src.map((r: any) => ({
      display_name: r.display_name,
      correct: N(r.correct),
      decided: N(r.decided),
      pct: Number.isFinite(N(r.accuracy)) ? (N(r.accuracy) <= 1 ? N(r.accuracy) * 100 : N(r.accuracy)) : NaN,
    })),
    streaks: streaks_src.map((r: any) => ({
      display_name: r.display_name,
      streak: N(r.longest_streak),
    })),
  }
}

/* ------------------------ page ------------------------ */

export default function StatsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-xl font-bold mb-3">Stats</h1>
          <div className="text-neutral-600">Loading…</div>
        </main>
      }
    >
      <StatsInner />
    </Suspense>
  )
}

function StatsInner() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [includeLive, setIncludeLive] = useState(false)

  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})
  const teamIndex = useMemo(() => buildTeamIndex(teamMap), [teamMap])

  const [mine, setMine] = useState<MyStatsPayload | null>(null)
  const [boards, setBoards] = useState<LeagueBoards | null>(null)
  const [msg, setMsg] = useState('')

  // boot: leagues + team map
  useEffect(() => {
    ;(async () => {
      try {
        const lj = await fetch('/api/my-leagues', { cache: 'no-store' }).then(r => r.json())
        const ls: League[] = lj?.leagues || []
        setLeagues(ls)
        if (!leagueId && ls[0]) {
          setLeagueId(ls[0].id)
          setSeason(ls[0].season)
        }
      } catch {}
      try {
        const tm = await fetch('/api/team-map', { cache: 'no-store' }).then(r => r.json())
        setTeamMap(tm?.teams || {})
      } catch {}
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // My Season: use leagueId+season if we have it; else season only
  useEffect(() => {
    if (!season) return
    ;(async () => {
      setMsg('')
      const url = leagueId ? `/api/my-stats?leagueId=${leagueId}&season=${season}` : `/api/my-stats?season=${season}`
      try {
        const res = await fetch(url, { cache: 'no-store' })
        const j = await res.json()
        setMine(normalizeMyStats(j))
      } catch (e: any) {
        console.warn('my-stats load failed', e)
        setMine(normalizeMyStats({ summary: {}, log: [] }))
        setMsg(e?.message || 'Failed to load my stats')
      }
    })()
  }, [leagueId, season])

  // League boards
  useEffect(() => {
    if (!leagueId || !season) return
    ;(async () => {
      try {
        const qs = new URLSearchParams({ leagueId, season: String(season) })
        if (includeLive) qs.set('includeLive', '1')
        const j = await fetch(`/api/league-stats?${qs.toString()}`, { cache: 'no-store' }).then(r => r.json())
        setBoards(normalizeBoards(j))
      } catch (e: any) {
        console.warn('league-stats load failed', e)
        setBoards({ avg_points: [], accuracy: [], streaks: [] })
        setMsg(e?.message || 'Failed to load league stats')
      }
    })()
  }, [leagueId, season, includeLive])

  const my = mine || { pick_log: [] }

  const metrics = [
    { label: 'Picks', value: intStr(my.picks_total) },
    { label: 'Correct', value: intStr(my.picks_correct) },
    { label: 'Win %', value: pctStr(my.win_pct) },
    { label: 'Longest Streak', value: intStr(my.longest_streak) },
    { label: 'Points', value: intStr(my.points_total) },
    { label: 'Avg / Pick', value: fixedStr(my.avg_points_per_pick, 2) },
    { label: 'Wrinkle Points', value: intStr(my.wrinkle_points), wide: true },
  ]

  const pickLog = Array.isArray(my.pick_log) ? my.pick_log : []

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <section className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Stats</h1>

        <div className="ml-auto flex items-center gap-3">
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

          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-black dark:accent-white"
              checked={includeLive}
              onChange={(e) => setIncludeLive(e.target.checked)}
            />
            Include LIVE
          </label>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* My Season */}
        <div className="lg:col-span-5">
          <Card title={`My Season (${season})`}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {metrics.map((m) => (
                <div
                  key={m.label}
                  className={['rounded-xl border px-4 py-3', m.wide ? 'sm:col-span-2' : ''].join(' ')}
                >
                  <div className="text-xs text-neutral-500">{m.label}</div>
                  <div className="text-2xl font-semibold">{m.value}</div>
                </div>
              ))}
            </div>

            <h3 className="mt-6 mb-2 font-medium">My Pick Log</h3>
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
                  {pickLog.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-neutral-500">
                        No picks yet.
                      </td>
                    </tr>
                  ) : (
                    pickLog.map((r, i) => {
                      const scoreStr =
                        r?.score && Number.isFinite(N(r.score.home)) && Number.isFinite(N(r.score.away))
                          ? `${N(r.score.home)}—${N(r.score.away)}`
                          : '—'
                      return (
                        <tr key={i} className="border-t">
                          <td className="py-2 pr-3">{Number.isFinite(N(r.week)) ? Math.trunc(N(r.week)) : '—'}</td>
                          <td className="py-2 pr-3">
                            <div className="max-w-[8rem]">
                              <TeamPill
                                teamId={r.team_id}
                                teamIndex={teamIndex}
                                size="sm"
                                mdUpSize="lg"
                                variant="subtle"
                                labelMode="abbrNick"
                              />
                            </div>
                          </td>
                          <td className="py-2 pr-3">{r.result ?? '—'}</td>
                          <td className="py-2 pr-3">{scoreStr}</td>
                          <td className="py-2 pr-3">{intStr(r.points)}</td>
                          <td className="py-2 pr-3">{r.wrinkle ? '✓' : '—'}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Leaderboards */}
        <div className="lg:col-span-7 grid gap-6">
          <Card
            title="Leaderboard — Avg Points / Pick"
            right={<span className="text-xs opacity-70">{includeLive ? '' : 'Finals only'}</span>}
          >
            <BoardTable
              rows={(boards?.avg_points || []).map((r) => ({
                name: r.display_name,
                col2: intStr(r.decided),
                col3: intStr(r.points),
                col4: fixedStr(r.avg, 2),
              }))}
              headers={['#', 'Member', 'Decided', 'Points', 'Avg/Pick']}
            />
          </Card>

          <Card
            title="Leaderboard — Pick Accuracy"
            right={<span className="text-xs opacity-70">{includeLive ? '' : 'Finals only'}</span>}
          >
            <BoardTable
              rows={(boards?.accuracy || []).map((r) => ({
                name: r.display_name,
                col2: intStr(r.correct),
                col3: intStr(r.decided),
                col4: Number.isFinite(N(r.pct)) ? `${N(r.pct).toFixed(1)}%` : '—',
              }))}
              headers={['#', 'Member', 'Correct', 'Decided', 'Accuracy']}
            />
          </Card>

          <Card title="Leaderboard — Longest Streak">
            <BoardTable
              rows={(boards?.streaks || []).map((r) => ({
                name: r.display_name,
                col2: intStr(r.streak),
              }))}
              headers={['#', 'Member', 'Streak']}
            />
          </Card>
        </div>
      </div>

      {msg && <div className="text-xs mt-2">{msg}</div>}
    </main>
  )
}

function BoardTable({
  rows,
  headers,
}: {
  rows: Array<{ name: string; col2?: string | number; col3?: string | number; col4?: string | number }>
  headers: string[]
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-neutral-500">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="py-2 pr-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="py-4 text-neutral-500">
                No data yet.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={`${r.name}-${i}`} className="border-t">
                <td className="py-2 pr-3">{i + 1}</td>
                <td className="py-2 pr-3">{r.name}</td>
                {'col2' in r && <td className="py-2 pr-3">{r.col2 ?? '—'}</td>}
                {'col3' in r && <td className="py-2 pr-3">{r.col3 ?? '—'}</td>}
                {'col4' in r && <td className="py-2 pr-3">{r.col4 ?? '—'}</td>}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
