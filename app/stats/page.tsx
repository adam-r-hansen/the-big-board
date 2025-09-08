'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TeamPill from '@/components/ui/TeamPill'
import { buildTeamIndex, type Team as TeamType } from '@/lib/teamColors'

type League = { id: string; name: string; season: number }
type Team = TeamType

type MyStats = {
  picks_total?: number
  picks_correct?: number
  win_pct?: number            // 0..100 or 0..1 depending on backend; we normalize below
  longest_streak?: number
  points_total?: number
  avg_points_per_pick?: number
  wrinkle_points?: number
  pick_log?: Array<{
    week?: number
    team_id?: string
    result?: 'W'|'L'|'T'|null
    score_str?: string | null // e.g. "24—20"
    points?: number | null
    wrinkle?: boolean | null
  }>
}

type LeagueBoards = {
  avg_points?: Array<{ profile_id: string; display_name: string; decided?: number; points?: number; avg?: number }>
  accuracy?: Array<{ profile_id: string; display_name: string; correct?: number; decided?: number; pct?: number }>
  streaks?: Array<{ profile_id: string; display_name: string; streak?: number }>
}

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

/** ---------- number safety helpers (prevents .toFixed on undefined) ---------- */
const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : fallback
}
const safePctStr = (v: unknown, alreadyPercent = true): string => {
  // backend may send 0..100 or 0..1; normalize to 0..100
  let n = num(v, NaN)
  if (!Number.isFinite(n)) return '—'
  if (!alreadyPercent) n *= 100
  return `${n.toFixed(1)}%`
}
const safeFixed = (v: unknown, dp = 2): string => {
  const n = num(v, NaN)
  return Number.isFinite(n) ? n.toFixed(dp) : '—'
}
const safeInt = (v: unknown): string => {
  const n = num(v, NaN)
  return Number.isFinite(n) ? String(Math.trunc(n)) : '—'
}

/** ---------- main page ---------- */
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

  const [mine, setMine] = useState<MyStats | null>(null)
  const [boards, setBoards] = useState<LeagueBoards | null>(null)
  const [msg, setMsg] = useState('')

  // boot
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

  // loads that depend on filters
  useEffect(() => {
    if (!season) return
    ;(async () => {
      setMsg('')
      try {
        const my = await fetch(`/api/my-stats?season=${season}`, { cache: 'no-store' }).then(r => r.json())
        setMine(my || {})
      } catch (e: any) {
        setMine({})
        setMsg(e?.message || 'Failed to load my stats')
      }
    })()
  }, [season])

  useEffect(() => {
    if (!leagueId || !season) return
    ;(async () => {
      try {
        const qs = new URLSearchParams({ leagueId, season: String(season) })
        if (includeLive) qs.set('includeLive', '1')
        const lb = await fetch(`/api/league-stats?${qs.toString()}`, { cache: 'no-store' }).then(r => r.json())
        setBoards(lb || {})
      } catch (e: any) {
        setBoards({})
        setMsg(e?.message || 'Failed to load league stats')
      }
    })()
  }, [leagueId, season, includeLive])

  // derived (display-friendly) values
  const picksTotal = safeInt(mine?.picks_total)
  const picksCorrect = safeInt(mine?.picks_correct)
  // try to detect if backend gave 0..100 or 0..1; assume <= 1 means ratio
  const winPct = (() => {
    const raw = num(mine?.win_pct, NaN)
    if (!Number.isFinite(raw)) return '—'
    return raw <= 1 ? safePctStr(raw, false) : safePctStr(raw, true)
  })()
  const longestStreak = safeInt(mine?.longest_streak)
  const pointsTotal = safeInt(mine?.points_total)
  const avgPerPick = safeFixed(mine?.avg_points_per_pick, 2)
  const wrinklePts = safeInt(mine?.wrinkle_points)

  const myLog = Array.isArray(mine?.pick_log) ? mine!.pick_log! : []

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <section className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Stats</h1>

        <div className="ml-auto flex items-center gap-3">
          {/* Primary nav already in SiteHeader; keep quick links if you like */}
          <Link className="underline text-sm" href="/picks">Picks</Link>
          <Link className="underline text-sm" href="/standings">Standings</Link>

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
              <Metric label="Picks" value={picksTotal} />
              <Metric label="Correct" value={picksCorrect} />
              <Metric label="Win %" value={winPct} />
              <Metric label="Longest Streak" value={longestStreak} />
              <Metric label="Points" value={pointsTotal} />
              <Metric label="Avg / Pick" value={avgPerPick} />
              <Metric label="Wrinkle Points" value={wrinklePts} wide />
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
                  {myLog.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-neutral-500">No picks yet.</td>
                    </tr>
                  ) : (
                    myLog.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-2 pr-3">{r.week ?? '—'}</td>
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
                        <td className="py-2 pr-3">{safeInt(r.points)}</td>
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
                col2: safeInt(r.decided),
                col3: safeInt(r.points),
                col4: safeFixed(r.avg, 2),
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
                const decided = num(r.decided, 0)
                const correct = num(r.correct, 0)
                const pct = decided > 0 ? (correct / decided) * 100 : NaN
                return {
                  name: r.display_name,
                  col2: safeInt(correct),
                  col3: safeInt(decided),
                  col4: safeFixed(pct, 1) === '—' ? '—' : `${safeFixed(pct, 1)}%`,
                }
              })}
              headers={['#', 'Member', 'Correct', 'Decided', 'Accuracy']}
            />
          </Card>

          <Card title="Leaderboard — Longest Streak">
            <BoardTable
              rows={(boards?.streaks || []).map((r) => ({
                name: r.display_name,
                col2: safeInt(r.streak),
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

/** ---------- little UI helpers ---------- */

function Metric({ label, value, wide = false }: { label: string; value: string | number; wide?: boolean }) {
  return (
    <div className={['rounded-xl border px-4 py-3', wide ? 'sm:col-span-2' : ''].join(' ')}>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
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
