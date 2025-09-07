// app/page.tsx
'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TeamPill from '@/components/ui/TeamPill'
import { buildTeamIndex, type Team as TeamType } from '@/lib/teamColors'

type League = { id: string; name: string; season: number }
type Team = TeamType
type Game = {
  id: string
  season: number
  week: number
  game_utc: string
  status?: string
  home: { id?: string; abbr?: string | null; score?: number | null }
  away: { id?: string; abbr?: string | null; score?: number | null }
}
type Pick = { id: string; team_id: string; game_id: string | null }

type MemberLockedPicks = {
  profile_id: string
  display_name: string
  points_week: number
  picks: Array<{
    game_id: string
    team_id: string
    status: 'LIVE' | 'FINAL'
    points: number | null
  }>
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

function StatusBadge({ s }: { s?: string }) {
  const up = (s || 'UPCOMING').toUpperCase()
  return (
    <span className="text-[10px] tracking-wide uppercase text-neutral-500 dark:text-neutral-400">
      {up}
    </span>
  )
}

function normalizeGames(rows: any[]): Game[] {
  return (rows || []).map((x: any) => ({
    id: x.id,
    season: x.season,
    week: x.week,
    game_utc: x.game_utc || x.start_time,
    status: x.status ?? 'UPCOMING',
    home: {
      id: x.home?.id ?? x.home_team ?? x.homeTeamId ?? x.home_team_id,
      abbr: x.home?.abbreviation ?? x.home_abbr ?? x.homeAbbr ?? x.home?.abbr ?? null,
      score: x.home_score ?? x.home?.score ?? null,
    },
    away: {
      id: x.away?.id ?? x.away_team ?? x.awayTeamId ?? x.away_team_id,
      abbr: x.away?.abbreviation ?? x.away_abbr ?? x.awayAbbr ?? x.away?.abbr ?? null,
      score: x.away_score ?? x.away?.score ?? null,
    },
  }))
}

function gameLocked(g?: Game) {
  if (!g) return false
  const s = (g.status || '').toUpperCase()
  if (s === 'FINAL' || s === 'LIVE') return true
  if (!g.game_utc) return false
  return new Date(g.game_utc) <= new Date()
}

function pickPointsForGame(pickTeamId: string, g?: Game): number | null {
  if (!g) return null
  const s = (g.status || '').toUpperCase()
  const hs = typeof g.home.score === 'number' ? g.home.score : null
  const as = typeof g.away.score === 'number' ? g.away.score : null
  if (s !== 'FINAL') return null
  if (hs == null || as == null) return 0
  if (hs === as) {
    if (g.home.id === pickTeamId) return hs / 2
    if (g.away.id === pickTeamId) return as / 2
    return 0
  }
  if (hs > as) {
    if (g.home.id === pickTeamId) return hs
    return 0
  }
  if (g.away.id === pickTeamId) return as
  return 0
}

function HomeInner() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number>(1)

  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})
  const teamIndex = useMemo(() => buildTeamIndex(teamMap), [teamMap])

  const [games, setGames] = useState<Game[]>([])
  const [myPicks, setMyPicks] = useState<Pick[]>([])
  const [wrinkleExtra, setWrinkleExtra] = useState<number>(0)

  const [leagueLocked, setLeagueLocked] = useState<MemberLockedPicks[]>([])
  const [standRows, setStandRows] = useState<any[]>([])
  const [msg, setMsg] = useState('')

  const singleLeague = leagues.length === 1
  const noLeagues = leagues.length === 0

  // load base data
  useEffect(() => {
    ;(async () => {
      try {
        const lj = await fetch('/api/my-leagues', { cache: 'no-store' }).then(r => r.json())
        const ls: League[] = lj?.leagues || []
        setLeagues(ls)
        if (ls.length === 1) {
          setLeagueId(ls[0].id)
          setSeason(ls[0].season)
        } else if (!leagueId && ls[0]) {
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

  // load per-week data
  useEffect(() => {
    if (!leagueId || !season || !week) return
    ;(async () => {
      setMsg('')
      try {
        const [g, p, w, s, L] = await Promise.all([
          fetch(`/api/games-for-week?season=${season}&week=${week}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/wrinkles/active?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
          fetch(`/api/standings?leagueId=${leagueId}&season=${season}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
          fetch(`/api/league-picks-week?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ members: [] })),
        ])

        setGames(normalizeGames(g?.games || g || []))
        setMyPicks((p?.picks || []).map((r: any) => ({ id: r.id, team_id: r.team_id, game_id: r.game_id })))
        const extra = Array.isArray(w?.wrinkles)
          ? w.wrinkles.reduce((acc: number, it: any) => acc + (Number(it?.extra_picks) || 0), 0)
          : 0
        setWrinkleExtra(extra)

        const rows = Array.isArray(s) ? s : (s?.standings || s?.rows || [])
        setStandRows(rows || [])

        setLeagueLocked(Array.isArray(L?.members) ? L.members : [])
      } catch (e: any) {
        setMsg(e?.message || 'Failed to load data')
      }
    })()
  }, [leagueId, season, week])

  // maps for quick lookups
  const gameById = useMemo(() => {
    const m = new Map<string, Game>()
    for (const g of games) m.set(g.id, g)
    return m
  }, [games])

  const picksAllowed = 2 + (wrinkleExtra || 0)
  const picksUsed = myPicks.length
  const picksLocked = useMemo(() => {
    let c = 0
    for (const p of myPicks) {
      if (!p.game_id) continue
      const g = gameById.get(p.game_id)
      if (gameLocked(g)) c++
    }
    return c
  }, [myPicks, gameById])

  const weekPoints = useMemo(() => {
    let sum = 0
    for (const p of myPicks) {
      if (!p.game_id) continue
      const g = gameById.get(p.game_id)
      const pts = pickPointsForGame(p.team_id, g)
      if (typeof pts === 'number') sum += pts
    }
    return sum
  }, [myPicks, gameById])

  // pills
  function pill(teamId?: string, opts?: { status?: string; points?: number | null }) {
    if (!teamId) return <TeamPill size="sm" />
    const s = (opts?.status || '').toUpperCase() as any
    return (
      <TeamPill
        teamId={teamId}
        teamIndex={teamIndex}
        size="sm"
        mdUpSize="md"
        variant="subtle"
        status={s}
        points={opts?.points ?? null}
        labelMode="abbr"
      />
    )
  }

  function pillForScoreboard(teamId?: string) {
    if (!teamId) return <TeamPill size="sm" mdUpSize="lg" />
    return (
      <TeamPill
        teamId={teamId}
        teamIndex={teamIndex}
        size="sm"
        mdUpSize="lg"
        variant="subtle"
        labelMode="abbr"
      />
    )
  }

  // standings normalization for mini view
  const miniStand = useMemo(() => {
    const rows = (standRows || []).map((r: any) => ({
      profile_id: r.profile_id ?? r.user_id ?? r.id ?? '',
      display_name: r.display_name ?? r.name ?? r.team ?? r.email ?? 'Member',
      points_total:
        typeof r.points_total === 'number'
          ? r.points_total
          : typeof r.points === 'number'
          ? r.points
          : typeof r.total_points === 'number'
          ? r.total_points
          : 0,
      points_week:
        typeof r.points_week === 'number'
          ? r.points_week
          : typeof r.week_points === 'number'
          ? r.week_points
          : 0,
    }))
    rows.sort((a, b) => (b.points_total || 0) - (a.points_total || 0))
    return rows.slice(0, 5)
  }, [standRows])

  const singleLeagueControls = !noLeagues && singleLeague

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      {/* Header controls */}
      <section className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">NFL Pick’em</h1>

        <div className="ml-auto flex items-center gap-3">
          <Link className="underline text-sm" href="/picks">Picks</Link>
          <Link className="underline text-sm" href="/standings">Standings</Link>

          {noLeagues ? null : singleLeagueControls ? (
            <span className="text-sm text-neutral-600">
              League: <strong>{leagues[0].name}</strong>
            </span>
          ) : (
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

          {/* Season & Week */}
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
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
          >
            {Array.from({ length: 18 }).map((_, i) => {
              const wk = i + 1
              return (
                <option key={wk} value={wk}>
                  {wk}
                </option>
              )
            })}
          </select>
        </div>
      </section>

      {noLeagues ? (
        <Card title="Join a league">
          <p className="text-sm text-neutral-600">
            Ask your commissioner for an invite link and visit <code>/join?leagueId=…</code>.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT 2/3 */}
          <div className="lg:col-span-8 grid gap-6">
            {/* Overview */}
            <Card
              title="League overview"
              right={
                <Link
                  href={`/picks?leagueId=${leagueId}&season=${season}&week=${week}`}
                  className="text-sm underline"
                >
                  Make picks →
                </Link>
              }
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border px-4 py-3">
                  <div className="text-xs text-neutral-500">Picks used</div>
                  <div className="text-2xl font-semibold">{picksUsed}</div>
                  <div className="text-xs text-neutral-500">of {picksAllowed}</div>
                </div>
                <div className="rounded-xl border px-4 py-3">
                  <div className="text-xs text-neutral-500">Points (wk)</div>
                  <div className="text-2xl font-semibold">{weekPoints}</div>
                </div>
                <div className="rounded-xl border px-4 py-3">
                  <div className="text-xs text-neutral-500">Remaining</div>
                  <div className="text-2xl font-semibold">
                    {Math.max(0, picksAllowed - picksUsed)}
                  </div>
                </div>
                <div className="rounded-xl border px-4 py-3">
                  <div className="text-xs text-neutral-500">Locked</div>
                  <div className="text-2xl font-semibold">{picksLocked}</div>
                </div>
              </div>
            </Card>

            {/* Week N — Games */}
            <Card
              title={`Week ${week} — Games`}
              right={
                <div className="flex items-center gap-3">
                  <Link
                    href={`/picks?leagueId=${leagueId}&season=${season}&week=${week}`}
                    className="text-sm underline"
                  >
                    Make picks →
                  </Link>
                  <Link href="/scoreboard" className="text-xs underline">
                    Scoreboard →
                  </Link>
                </div>
              }
            >
              {games.length === 0 ? (
                <div className="text-sm text-neutral-500">No games.</div>
              ) : (
                <div className="grid gap-4">
                  {games.map((g) => {
                    const kickoff = g.game_utc ? new Date(g.game_utc).toLocaleString() : ''
                    const scoreKnown =
                      typeof g.home.score === 'number' && typeof g.away.score === 'number'

                    const homeChip = pillForScoreboard(g.home.id)
                    const awayChip = pillForScoreboard(g.away.id)

                    return (
                      <article
                        key={g.id}
                        className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
                      >
                        <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
                          <span>
                            {kickoff} • Week {g.week}
                          </span>
                          <StatusBadge s={g.status} />
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">{homeChip}</div>
                          <div className="text-neutral-400">—</div>
                          <div className="flex-1">{awayChip}</div>
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {scoreKnown ? (
                            <span>
                              Score: {g.home.score} — {g.away.score}
                            </span>
                          ) : (
                            <span>— — —</span>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT 1/3 */}
          <aside className="lg:col-span-4 grid gap-6">
            {/* My Picks */}
            <Card
              title={`My picks — Week ${week}`}
              right={
                <Link
                  href={`/picks?leagueId=${leagueId}&season=${season}&week=${week}`}
                  className="text-xs underline"
                >
                  Edit on Picks →
                </Link>
              }
            >
              {myPicks.length === 0 ? (
                <div className="text-sm text-neutral-500">No picks yet.</div>
              ) : (
                <ul className="grid gap-2">
                  {myPicks.map((p) => {
                    const g = p.game_id ? gameById.get(p.game_id) : undefined
                    const s = (g?.status || (gameLocked(g) ? 'LIVE' : 'UPCOMING')).toUpperCase() as any
                    const pts = pickPointsForGame(p.team_id, g)
                    return (
                      <li key={p.id} className="flex items-center justify-between">
                        {pill(p.team_id, { status: s, points: typeof pts === 'number' ? pts : null })}
                        <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                          {s}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            {/* League picks (locked) */}
            <Card title="League picks (locked)">
              {leagueLocked.length === 0 ? (
                <div className="text-sm text-neutral-500">No locked picks yet.</div>
              ) : (
                <ul className="grid gap-3">
                  {leagueLocked.map((m) => (
                    <li key={m.profile_id} className="border rounded-xl px-3 py-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{m.display_name || 'Member'}</span>
                        <span className="text-neutral-600">{m.points_week ?? 0} pts</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.picks && m.picks.length > 0 ? (
                          m.picks.map((pk) => (
                            <TeamPill
                              key={pk.game_id + pk.team_id}
                              teamId={pk.team_id}
                              teamIndex={teamIndex}
                              size="sm"
                              mdUpSize="md"
                              variant="subtle"
                              status={pk.status}
                              points={pk.status === 'FINAL' ? pk.points ?? null : null}
                            />
                          ))
                        ) : (
                          <span className="text-xs text-neutral-500">No locked picks yet.</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Standings mini */}
            <Card
              title="Standings"
              right={
                <Link
                  href={`/standings?leagueId=${leagueId}&season=${season}`}
                  className="text-xs underline"
                >
                  Standings →
                </Link>
              }
            >
              {miniStand.length === 0 ? (
                <div className="text-sm text-neutral-500">No standings yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-neutral-500">
                      <tr>
                        <th className="py-2 pr-3">#</th>
                        <th className="py-2 pr-3">Member</th>
                        <th className="py-2 pr-3">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {miniStand.map((r, i) => (
                        <tr key={r.profile_id} className="border-t">
                          <td className="py-2 pr-3">{i + 1}</td>
                          <td className="py-2 pr-3">{r.display_name}</td>
                          <td className="py-2 pr-3">{r.points_total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </aside>
        </div>
      )}
      {msg && <div className="text-xs mt-2">{msg}</div>}
    </main>
  )
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-xl font-bold mb-3">NFL Pick’em</h1>
          <div className="text-neutral-600">Loading…</div>
        </main>
      }
    >
      <HomeInner />
    </Suspense>
  )
}
