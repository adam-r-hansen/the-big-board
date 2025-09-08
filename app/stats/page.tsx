'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import TeamPill from '@/components/ui/TeamPill'
import { buildTeamIndex, type Team as TeamType } from '@/lib/teamColors'

type League = { id: string; name: string; season: number }
type Team = TeamType

type PickRow = {
  week?: number
  team_id?: string
  result?: 'W' | 'L' | 'T' | null
  score_str?: string | null
  points?: number | null
  wrinkle?: boolean | null
}

type MyStatsPayload = {
  picks_total?: number
  picks_correct?: number
  win_pct?: number // 0..100 or 0..1
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

/* ------------------------ UI bits ------------------------ */

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

const n = (v: unknown): number => {
  const x = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(x) ? x : NaN
}
const intStr = (v: unknown): string => (Number.isFinite(n(v)) ? String(Math.trunc(n(v))) : '—')
const fixedStr = (v: unknown, dp = 2): string => (Number.isFinite(n(v)) ? n(v).toFixed(dp) : '—')
const pctStr = (v: unknown): string => {
  let x = n(v)
  if (!Number.isFinite(x)) return '—'
  if (x <= 1) x *= 100
  return `${x.toFixed(1)}%`
}

/* ------------------------ helpers: derive stats ------------------------ */

function deriveMyStats(base: Partial<MyStatsPayload>): MyStatsPayload {
  const rows: PickRow[] = Array.isArray(base.pick_log) ? base.pick_log : []

  const picks_total =
    Number.isFinite(n(base.picks_total)) ? n(base.picks_total) : rows.length

  const picks_correct =
    Number.isFinite(n(base.picks_correct))
      ? n(base.picks_correct)
      : rows.reduce((acc, r) => acc + (r.result === 'W' ? 1 : 0), 0)

  const points_total =
    Number.isFinite(n(base.points_total))
      ? n(base.points_total)
      : rows.reduce((acc, r) => acc + (Number.isFinite(n(r.points)) ? n(r.points) : 0), 0)

  const avg_points_per_pick =
    Number.isFinite(n(base.avg_points_per_pick))
      ? n(base.avg_points_per_pick)
      : picks_total > 0
      ? points_total / picks_total
      : NaN

  const wrinkle_points =
    Number.isFinite(n(base.wrinkle_points))
      ? n(base.wrinkle_points)
      : rows.reduce((acc, r) => acc + (r.wrinkle && Number.isFinite(n(r.points)) ? n(r.points) : 0), 0)

  // longest streak of consecutive W (simple pass; if ties should break streak, adjust here)
  let longest = Number.isFinite(n(base.longest_streak)) ? n(base.longest_streak) : NaN
  if (!Number.isFinite(longest)) {
    let cur = 0
    longest = 0
    // sort by week if provided, else by insertion
    const sorted = [...rows].sort((a, b) => (n(a.week) || 0) - (n(b.week) || 0))
    for (const r of sorted) {
      if (r.result === 'W') {
        cur += 1
        if (cur > longest) longest = cur
      } else if (r.result === 'L' || r.result === 'T') {
        cur = 0
      }
    }
  }

  let win_pct =
    Number.isFinite(n(base.win_pct))
      ? n(base.win_pct)
      : picks_total > 0
      ? (picks_correct / picks_total) * 100
      : NaN

  return {
    picks_total,
    picks_correct,
    win_pct,
    longest_streak: longest,
    points_total,
    avg_points_per_pick,
    wrinkle_points,
    pick_log: rows,
  }
}

/* ------------------------ main page ------------------------ */

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

  // My Season — try (leagueId+season). If empty or fails, retry without leagueId.
  useEffect(() => {
    if (!season) return
    ;(async () => {
      setMsg('')
      const tryOnce = async (url: string) => {
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      }
      try {
        const withLeague = leagueId ? `/api/my-stats?leagueId=${leagueId}&season=${season}` : `/api/my-stats?season=${season}`
        let j: any
        try {
          j = await tryOnce(withLeague)
        } catch {
          // fallback: some installs only accept ?season
          j = await tryOnce(`/api/my-stats?season=${season}`)
        }

        // Normalize shape & keys
        const root: any = j?.stats ?? j?.data ?? j ?? {}
        const pick_log: PickRow[] =
          (Array.isArray(root.pick_log) && root.pick_log) ||
          (Array.isArray(root.rows) && root.rows) ||
          []

        const base: Partial<MyStatsPayload> = {
          picks_total: root.picks_total ?? root.picks,
          picks_correct: root.picks_correct ?? root.correct,
          win_pct: root.win_pct ?? root.winPct,
          longest_streak: root.longest_streak ?? root.longestStreak,
          points_total: root.points_total ?? root.points,
          avg_points_per_pick: root.avg_points_per_pick ?? root.avgPerPick,
          wrinkle_points: root.wrinkle_points ?? root.wrinklePoints,
          pick_log,
        }

        setMine(deriveMyStats(base))
      } catch (e: any) {
        console.warn('my-stats load failed', e)
        setMine(deriveMyStats({ pick_log: [] }))
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

        const root: any = j?.data ?? j ?? {}
        const payload: LeagueBoards = {
          avg_points: Array.isArray(root.avg_points) ? root.avg_points : Array.isArray(root.rows?.avg_points) ? root.rows.avg_points : [],
          accuracy: Array.isArray(root.accuracy) ? root.accuracy : Array.isArray(root.rows?.accuracy) ? root.rows.accuracy : [],
          streaks: Array.isArray(root.streaks) ? root.streaks : Array.isArray(root.rows?.streaks) ? root.rows.streaks : [],
        }
        setBoards(payload)
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
      {/* Header (no extra in-page nav; SiteHeader has global nav) */}
      <section className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Stats</h1>

        <div className="ml-auto flex items-center gap-3">
          {/* Season */}
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

          {/* League */}
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
                  className={[
                    'rounded-xl border px-4 py-3',
                    m.wide ? 'sm:col-span-2' : '',
                  ].join(' ')}
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
                    pickLog.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-2 pr-3">{Number.isFinite(n(r.week)) ? Math.trunc(n(r.week)) : '—'}</td>
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
                        <td className="py-2 pr-3">{r.score_str ?? '—'}</td>
                        <td className="py-2 pr-3">{intStr(r.points)}</td>
                        <td className="py-2 pr-3">{r.wrinkle ? '✓' : '—'}</td>
                      </tr>
                    ))
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
              rows={(boards?.accuracy || []).map((r) => {
                const decided = n(r.decided)
                const correct = n(r.correct)
                const pct = Number.isFinite(decided) && decided > 0 ? (correct / decided) * 100 : NaN
                return {
                  name: r.display_name,
                  col2: intStr(correct),
                  col3: intStr(decided),
                  col4: Number.isFinite(pct) ? `${pct.toFixed(1)}%` : '—',
                }
              })}
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
