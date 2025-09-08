// app/page.tsx
'use client'

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'

type League = { id: string; name: string; season: number }

type Team = {
  id: string
  abbreviation: string | null
  short_name?: string | null
  name?: string | null
  color_primary?: string | null
  color_secondary?: string | null
  color_tertiary?: string | null
  color_quaternary?: string | null
  logo?: string | null
  logo_dark?: string | null
  // Admin prefs
  ui_light_color_key?: 'color_primary' | 'color_secondary' | 'color_tertiary' | 'color_quaternary' | null
  ui_dark_color_key?: 'color_primary' | 'color_secondary' | 'color_tertiary' | 'color_quaternary' | null
  color_pref_light?: string | null
  color_pref_dark?: string | null
}

type TeamLike = {
  id?: string
  abbreviation?: string
  short_name?: string
  name?: string
  // raw palette
  color_primary?: string
  color_secondary?: string
  color_tertiary?: string
  color_quaternary?: string
  // resolved UI colors
  ui_light?: string
  ui_dark?: string
}

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

/** ---------------------------
 *  Color helpers / Team index
 *  ---------------------------
 */
function resolveUiColor(
  team: Team,
  mode: 'light' | 'dark',
): string | undefined {
  // 1) explicit overrides win
  if (mode === 'light' && team.color_pref_light) return team.color_pref_light
  if (mode === 'dark' && team.color_pref_dark) return team.color_pref_dark
  // 2) otherwise use the chosen key
  const key =
    mode === 'light' ? team.ui_light_color_key : team.ui_dark_color_key
  if (!key) return undefined
  const hex = (team as any)[key] as string | undefined
  return hex || undefined
}

function useTeamIndex(teamMap: Record<string, Team>) {
  return useMemo(() => {
    const idx: Record<string, TeamLike> = {}
    for (const t of Object.values(teamMap || {})) {
      const v: TeamLike = {
        id: t.id,
        abbreviation: t.abbreviation ?? undefined,
        short_name: t.short_name ?? undefined,
        name: t.name ?? undefined,
        color_primary: t.color_primary ?? undefined,
        color_secondary: t.color_secondary ?? undefined,
        color_tertiary: t.color_tertiary ?? undefined,
        color_quaternary: t.color_quaternary ?? undefined,
        ui_light: resolveUiColor(t, 'light') ?? t.color_secondary ?? t.color_primary ?? '#6b7280',
        ui_dark: resolveUiColor(t, 'dark') ?? t.color_primary ?? t.color_secondary ?? '#374151',
      }
      if (t.id) idx[t.id] = v
      if (t.abbreviation) idx[t.abbreviation.toUpperCase()] = v
    }
    return idx
  }, [teamMap])
}

/** --------------------------------
 *  TeamPill — unified visual token
 *  --------------------------------
 *  - Uniform sizes
 *  - Primary border color (dark mode uses ui_dark)
 *  - Subtle soft fill using the opposite color
 *  - Abbr on mobile, full name on md+
 */
function TeamPill({
  team,
  className = '',
  title,
}: {
  team?: TeamLike
  className?: string
  title?: string
}) {
  const abbr = team?.abbreviation || '—'
  const full = team?.name || team?.short_name || abbr
  const primary = team?.ui_dark || '#374151'
  const secondary = team?.ui_light || '#6b7280'

  return (
    <span
      title={title || full}
      className={[
        // uniform size & shape
        'inline-flex items-center justify-center rounded-2xl border font-semibold',
        'h-10 md:h-12 w-full md:w-64 px-4 md:px-6',
        // text truncation
        'whitespace-nowrap truncate',
        className,
      ].join(' ')}
      style={{
        borderColor: primary,
        color: primary,
        // subtle soft background using the opposite color
        background: `${secondary}10`,
      }}
    >
      <span className="truncate max-w-full">
        <span className="md:hidden">{abbr}</span>
        <span className="hidden md:inline">{full}</span>
      </span>
    </span>
  )
}

// compact chip used in sidebars / lists
function TinyTeamPill({
  team,
  status,
  points,
  className = '',
}: {
  team?: TeamLike
  status?: string
  points?: number | null
  className?: string
}) {
  const primary = team?.ui_dark || '#374151'
  const secondary = team?.ui_light || '#6b7280'
  const badge =
    status?.toUpperCase() === 'FINAL'
      ? (typeof points === 'number' ? `+${points}` : '')
      : status?.toUpperCase() === 'LIVE'
      ? '• LIVE'
      : ''

  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-2xl border h-9 md:h-10 px-3 font-semibold',
        className,
      ].join(' ')}
      style={{
        borderColor: primary,
        color: primary,
        background: `${secondary}10`,
      }}
    >
      <span className="truncate">
        <span className="md:hidden">{team?.abbreviation || '—'}</span>
        <span className="hidden md:inline">{team?.name || team?.short_name || team?.abbreviation || '—'}</span>
      </span>
      {badge ? <span className="text-xs opacity-80">{badge}</span> : null}
    </span>
  )
}

/** -----------------
 *  Data normalizers
 *  -----------------
 */
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
  const teamIndex = useTeamIndex(teamMap)

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
        const [g, p, w, s, ls] = await Promise.all([
          fetch(`/api/games-for-week?season=${season}&week=${week}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/wrinkles/active?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
          fetch(`/api/standings?leagueId=${leagueId}&season=${season}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
          // use league-stats for stable weekly log
          fetch(`/api/league-stats?leagueId=${leagueId}&season=${season}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        ])

        setGames(normalizeGames(g?.games || g || []))
        setMyPicks((p?.picks || []).map((r: any) => ({ id: r.id, team_id: r.team_id, game_id: r.game_id })))

        const extra = Array.isArray(w?.wrinkles)
          ? w.wrinkles.reduce((acc: number, it: any) => acc + (Number(it?.extra_picks) || 0), 0)
          : 0
        setWrinkleExtra(extra)

        const rows = Array.isArray(s) ? s : (s?.standings || s?.rows || [])
        setStandRows(rows || [])

        // Build League picks (locked) from league-stats log for this week
        type LSRow = {
          week: number
          profile_id: string
          display_name?: string
          team_id: string
          game_id: string
          status?: string
          points?: number | null
        }
        const log: LSRow[] = Array.isArray(ls?.log) ? ls.log : []
        const by = new Map<string, MemberLockedPicks>()
        for (const r of log) {
          if (r.week !== week) continue
          const s = String(r.status || '').toUpperCase()
          if (s !== 'FINAL' && s !== 'LIVE') continue
          if (!by.has(r.profile_id)) {
            by.set(r.profile_id, {
              profile_id: r.profile_id,
              display_name: r.display_name || 'Member',
              points_week: 0,
              picks: [],
            })
          }
          const entry = by.get(r.profile_id)!
          entry.picks.push({
            game_id: r.game_id,
            team_id: r.team_id,
            status: (s === 'FINAL' ? 'FINAL' : 'LIVE'),
            points: typeof r.points === 'number' ? r.points : null,
          })
          if (typeof r.points === 'number') entry.points_week += r.points
        }
        setLeagueLocked(Array.from(by.values()).sort((a, b) => (b.points_week || 0) - (a.points_week || 0)))
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
    }))
    rows.sort((a, b) => (b.points_total || 0) - (a.points_total || 0))
    return rows.slice(0, 5)
  }, [standRows])

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      {/* Header controls */}
      <section className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">NFL Pick’em</h1>

        <div className="ml-auto flex items-center gap-3">
          <Link className="underline text-sm" href="/picks">Picks</Link>
          <Link className="underline text-sm" href="/standings">Standings</Link>

          {/* League control: label if 1 league, dropdown if >1 */}
          {noLeagues ? null : leagues.length === 1 ? (
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

          {/* Season & Week (always shown) */}
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
                    const home = teamIndex[g.home.id || '']
                    const away = teamIndex[g.away.id || '']

                    return (
                      <article
                        key={g.id}
                        className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
                      >
                        <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
                          <span>
                            {kickoff} • Week {g.week}
                          </span>
                          <span className="text-[10px] tracking-wide uppercase">
                            {(g.status || 'UPCOMING').toUpperCase()}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <TeamPill team={home} />
                          </div>
                          <div className="text-neutral-400">—</div>
                          <div className="flex-1">
                            <TeamPill team={away} />
                          </div>
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
                    const s = (g?.status || (gameLocked(g) ? 'LIVE' : 'UPCOMING')).toUpperCase()
                    const pts = pickPointsForGame(p.team_id, g)
                    const tm = teamIndex[p.team_id]
                    return (
                      <li key={p.id} className="flex items-center justify-between">
                        <TinyTeamPill
                          team={tm}
                          status={s}
                          points={typeof pts === 'number' ? pts : null}
                        />
                        <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                          {s}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            {/* League picks (locked), grouped by member */}
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
                          m.picks.map((pk, i) => (
                            <TinyTeamPill
                              key={`${pk.team_id}-${i}`}
                              team={teamIndex[pk.team_id]}
                              status={pk.status}
                              points={pk.status === 'FINAL' ? pk.points ?? null : null}
                              className="md:mr-1"
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
