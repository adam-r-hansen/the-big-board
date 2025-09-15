'use client'
// app/page.tsx

/**
 * Home: overview + scoreboard (left 2/3), and
 * My Picks / League Picks (locked only) / Standings mini (right 1/3).
 *
 * Scoring:
 *  - Win  -> team final score
 *  - Loss -> 0
 *  - Tie  -> half of team final score (e.g. 10 -> 5)
 *
 * Default Week Logic:
 *  - NFL week boundaries are Tuesday → Monday.
 *  - Anchor = first Tuesday on/after September 1 of the selected season.
 *  - currentWeek = 1 + floor((today - anchor)/7 days), clamped to 1…18.
 */

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import GameCard, { type GameCardGame } from '@/components/ui/GameCard'
import AdminNavLink from '@/components/AdminNavLink'
import { createClient as createSupabaseClient } from '@/utils/supabase/client'

// —————————————————————————————————————————————————————
// Minimal utility (replaces '@/lib/utils')
// —————————————————————————————————————————————————————
function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

// —————————————————————————————————————————————————————
// Types mirrored from API responses (kept loose/defensive)
// —————————————————————————————————————————————————————
type League = { id: string; name: string; season: number }
type Team = {
  id: string
  abbreviation: string | null
  name?: string | null
  color_primary?: string | null
  color_secondary?: string | null
  logo?: string | null
  logo_dark?: string | null
}
type TeamLike = {
  id?: string
  abbreviation?: string | null
  name?: string | null
  color_primary?: string | null
  color_secondary?: string | null
  logo?: string | null
  logo_dark?: string | null
  ui_light_color_key?: string | null
  ui_dark_color_key?: string | null
}
type Game = {
  id: string
  week: number
  game_utc?: string | null
  status?: 'UPCOMING' | 'LIVE' | 'FINAL' | string
  home: { id?: string; abbr?: string | null; score?: number | null }
  away: { id?: string; abbr?: string | null; score?: number | null }
}
type Pick = {
  id: string
  team_id: string
  game_id?: string | null
  status?: 'UPCOMING' | 'LIVE' | 'FINAL' | string
  points?: number | null
}
type MemberLockedPicks = {
  profile_id: string
  display_name?: string | null
  points_week?: number | null
  picks?: Array<{ team_id: string; status?: string; points?: number | null }>
}

// —————————————————————————————————————————————————————
// Small UI bits
// —————————————————————————————————————————————————————
function Card(props: { title: string; right?: React.ReactNode; className?: string; children: React.ReactNode }) {
  const { title, right, className, children } = props
  return (
    <section
      className={cn(
        'rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5',
        className
      )}
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </header>
      <div>{children}</div>
    </section>
  )
}

// —————————————————————————————————————————————————————
// Helpers
// —————————————————————————————————————————————————————
function gameLocked(g?: Game | null) {
  if (!g) return false
  const s = (g.status || '').toUpperCase()
  return s === 'LIVE' || s === 'FINAL'
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
  if (hs > as) return g.home.id === pickTeamId ? hs : 0
  return g.away.id === pickTeamId ? as : 0
}

function useTeamIndex(teamMap: Record<string, Team>) {
  return useMemo(() => {
    const m: Record<string, TeamLike> = {}
    for (const t of Object.values(teamMap || {})) {
      const v: TeamLike = {
        id: t.id,
        abbreviation: t.abbreviation,
        name: t.name,
        color_primary: t.color_primary,
        color_secondary: t.color_secondary,
        logo: t.logo,
        logo_dark: t.logo_dark,
      }
      m[t.id] = v
      if (t.abbreviation) m[t.abbreviation] = v
      if (t.abbreviation) m[t.abbreviation.toUpperCase()] = v
    }
    return m
  }, [teamMap])
}

function useGameByTeamId(games: Game[]) {
  return useMemo(() => {
    const m = new Map<string, Game>()
    for (const g of games) {
      if (g.home?.id) m.set(g.home.id, g)
      if (g.away?.id) m.set(g.away.id, g)
    }
    return m
  }, [games])
}

// —————————————————————————————————————————————————————
// NFL week calc (Tuesday→Monday) by season
// —————————————————————————————————————————————————————
function firstTuesdayOnOrAfterSept1(seasonYear: number) {
  const d = new Date(seasonYear, 8 /* Sept */, 1, 0, 0, 0, 0)
  const day = d.getDay() // 0=Sun..2=Tue
  const delta = (9 - day) % 7
  d.setDate(d.getDate() + delta)
  return d
}
function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function currentNflWeekForSeason(seasonYear: number, today = new Date()): number {
  const anchor = firstTuesdayOnOrAfterSept1(seasonYear)
  if (today.getTime() < anchor.getTime()) return 1
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const diffDays = Math.floor((stripTime(today).getTime() - stripTime(anchor).getTime()) / MS_PER_DAY)
  const week = 1 + Math.floor(diffDays / 7)
  return Math.min(18, Math.max(1, week))
}

// —————————————————————————————————————————————————————
function HomeInner() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number>(1)
  const [userPickedWeek, setUserPickedWeek] = useState(false)

  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})
  const teamIndex = useTeamIndex(teamMap)

  const [games, setGames] = useState<Game[]>([])
  const gameByTeamId = useGameByTeamId(games)

  const [myPicks, setMyPicks] = useState<Pick[]>([])
  const [wrinkleExtra, setWrinkleExtra] = useState<number>(0)

  const [leagueLocked, setLeagueLocked] = useState<MemberLockedPicks[]>([])
  const [standRows, setStandRows] = useState<any[]>([])
  const [msg, setMsg] = useState('')

  const [authReady, setAuthReady] = useState(false)

  const singleLeague = leagues.length === 1
  const noLeagues = leagues.length === 0

  // derive picks info
  const picksUsed = myPicks.length
  const picksAllowed = 2 + (wrinkleExtra || 0)
  const picksLocked = myPicks.filter((p) => p.status === 'FINAL' || p.status === 'LIVE').length
  const weekPoints = myPicks.reduce((acc, p) => acc + (typeof p.points === 'number' ? p.points : 0), 0)

  // Auth callback cleanup + ready flag
  useEffect(() => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')

    ;(async () => {
      try {
        if (code) {
          const supabase = createSupabaseClient()
          const { error } = await supabase.auth.exchangeCodeForSession(code)

          // Clean auth-related params from URL
          const AUTH_PARAMS = [
            'code',
            'type',
            'scope',
            'auth_callback',
            'next',
            'redirect_to',
            'provider',
            'refresh_token',
            'access_token',
          ]
          const clean = new URL(window.location.href)
          AUTH_PARAMS.forEach((p) => clean.searchParams.delete(p))
          window.history.replaceState({}, '', clean.toString())

          if (error) {
            console.error('Auth exchange error:', error)
            setMsg('Signed in, but hit an auth redirect error. Please refresh if things look off.')
          }
        }
      } catch (e) {
        console.error('Auth handling failed', e)
      } finally {
        setAuthReady(true)
      }
    })()
  }, [])

  // Load leagues, teams, games, my picks, wrinkles, standings, league locked picks
  useEffect(() => {
    if (!authReady) return

    ;(async () => {
      try {
        const [{ leagues: L }, t, g, p, w, s] = await Promise.all([
          fetch('/api/leagues', { cache: 'no-store' }).then((r) => r.json()),
          fetch('/api/teams', { cache: 'no-store' }).then((r) => r.json()),
          fetch(`/api/games-for-week?season=${season}&week=${week}`, { cache: 'no-store' }).then((r) => r.json()),
          fetch(`/api/my-picks?season=${season}&week=${week}`, { cache: 'no-store' }).then((r) => r.json()),
          fetch(`/api/wrinkles?leagueId=${leagueId}`, { cache: 'no-store' }).then((r) => r.json()),
          fetch(`/api/standings?leagueId=${leagueId}&season=${season}`, { cache: 'no-store' }).then((r) => r.json()),
        ])

        // leagues
        const leaguesArr = Array.isArray(L) ? L : L?.rows || []
        setLeagues(leaguesArr)
        if (leaguesArr.length === 1) {
          setLeagueId(leaguesArr[0].id)
          setSeason(leaguesArr[0].season)
        }

        // teams
        const teamsArr = Array.isArray(t?.teams) ? t.teams : Array.isArray(t) ? t : []
        const map: Record<string, Team> = {}
        for (const it of teamsArr) {
          if (!it?.id) continue
          map[it.id] = it
          const ab = it.abbreviation || (it as any).abbr
          if (ab) {
            map[ab] = it as Team
            map[ab.toUpperCase()] = it as Team
          }
        }
        setTeamMap(map)

        // games
        const gNorm = normalizeGames(g?.games || g || [])
        setGames(gNorm)

        // picks
        const pArr = Array.isArray(p?.picks) ? p.picks : Array.isArray(p) ? p : []
        setMyPicks(pArr)

        // wrinkle extra picks
        const extra = Array.isArray(w?.wrinkles)
          ? w.wrinkles.reduce((acc: number, it: any) => acc + (Number(it?.extra_picks) || 0), 0)
          : 0
        setWrinkleExtra(extra)

        // standings
        const rows = Array.isArray(s) ? s : (s?.standings || s?.rows || [])
        setStandRows(rows || [])

        // league locked picks — support both response shapes
        if (Array.isArray(L?.members)) {
          setLeagueLocked(L.members as MemberLockedPicks[])
        } else if (Array.isArray(L?.rows)) {
          const grouped = new Map<string, MemberLockedPicks>()
          const safeName = (r: any) =>
            r?.display_name ||
            r?.name ||
            r?.profile_name ||
            `${(r?.first_name || '').trim()} ${(r?.last_name || '').trim()}`.trim() ||
            r?.email ||
            'Member'

          for (const r of L.rows) {
            const id = r.profile_id || r.member_id || r.id
            if (!id) continue
            if (!grouped.has(id)) {
              grouped.set(id, { profile_id: id, display_name: safeName(r), points_week: r.points_week || 0, picks: [] })
            }
            const acc = grouped.get(id)!
            if (r.team_id) {
              acc.picks!.push({ team_id: r.team_id, status: (r.status || '').toUpperCase(), points: r.points ?? null })
            }
          }
          setLeagueLocked(Array.from(grouped.values()))
        }
      } catch (e) {
        console.error('Home load failed:', e)
        setMsg('Failed to load some data. Try refresh.')
      }
    })()
  }, [authReady, leagueId, season, week])

  // Pin to single league's season if only one
  useEffect(() => {
    if (leagues.length === 1) {
      const L = leagues[0]
      setLeagueId(L.id)
      setSeason(L.season)
    }
  }, [leagues])

  // Default the week based on NFL Tue→Mon boundaries (don’t override manual pick)
  useEffect(() => {
    if (userPickedWeek) return
    const computed = currentNflWeekForSeason(season, new Date())
    if (computed !== week) setWeek(computed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season])

  // ——— UI helpers ———
  const gameById = useMemo(() => {
    const m = new Map<string, Game>()
    for (const g of games) m.set(g.id, g)
    return m
  }, [games])

  function teamChipForId(teamId: string, opts?: { status?: 'UPCOMING' | 'LIVE' | 'FINAL'; showPoints?: number | null }) {
    const t = teamIndex[teamId]
    const status = (opts?.status || 'UPCOMING').toUpperCase()
    const showPoints = typeof opts?.showPoints === 'number' ? opts!.showPoints : null

    const mono =
      status === 'FINAL'
        ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
        : status === 'LIVE'
        ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200'

    return (
      <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm', mono)}>
        <span className="font-semibold">{t?.abbreviation || '—'}</span>
        {showPoints != null && <span className="text-[10px] font-bold">{showPoints} pts</span>}
      </span>
    )
  }

  // ——— Normalize games from API ———
  function normalizeGames(arr: any[]): Game[] {
    return (arr || []).map((x) => ({
      id:
        x.id ||
        x.game_id ||
        `${x.season}-${x.week}-${x.home_abbr ?? x.home?.abbr ?? ''}-${x.away_abbr ?? x.away?.abbr ?? ''}`,
      week: Number(x.week ?? x.game_week ?? 0),
      game_utc: x.game_utc ?? x.kickoff ?? x.date ?? null,
      status: (x.status || x.state || 'UPCOMING').toUpperCase(),
      home: {
        id: x.home_id ?? x.home?.id ?? x.homeTeamId ?? x.home_abbr ?? x.home?.abbr ?? x.home?.abbreviation ?? null,
        abbr: x.home_abbr ?? x.home?.abbr ?? x.home?.abbreviation ?? null,
        score: x.home_score ?? x.home?.score ?? null,
      },
      away: {
        id: x.away_id ?? x.away?.id ?? x.awayTeamId ?? x.away_abbr ?? x.away?.abbr ?? x.away?.abbreviation ?? null,
        abbr: x.away_abbr ?? x.away?.abbr ?? x.away?.abbreviation ?? null,
        score: x.away_score ?? x.away?.score ?? null,
      },
    }))
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">NFL Pick’em</h1>
        <div className="flex items-center gap-2">
          <AdminNavLink />
        </div>
      </header>

      {/* League + filters */}
      <section className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">League</label>
          <select
            className="w-full rounded-lg border bg-transparent px-3 py-2"
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
          >
            {!leagueId && <option value="">—</option>}
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
            className="w-full rounded-lg border bg-transparent px-3 py-2"
            value={season}
            onChange={(e) => {
              setSeason(Number(e.target.value))
            }}
          />
        </div>

        <div>
          <label className="block text-xs text-neutral-500 mb-1">Week</label>
          <select
            className="w-full rounded-lg border bg-transparent px-3 py-2"
            value={week}
            onChange={(e) => {
              setWeek(Number(e.target.value))
              setUserPickedWeek(true)
            }}
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
        <div className="grid lg:grid-cols-12 gap-6">
          {/* LEFT 2/3 */}
          <div className="lg:col-span-8 grid gap-6">
            {/* Overview */}
            <Card
              title="League overview"
              right={
                <Link href={`/picks?leagueId=${leagueId}&season=${season}&week=${week}`} className="text-sm underline">
                  Make picks →
                </Link>
              }
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border px-4 py-3">
                  <div className="text-xs text-neutral-500">Picks used</div>
                  <div className="text-2xl font-semibold">{picksUsed}</div>
                </div>
                <div className="rounded-xl border px-4 py-3">
                  <div className="text-xs text-neutral-500">Points (wk)</div>
                  <div className="text-2xl font-semibold">{weekPoints}</div>
                </div>
                <div className="rounded-xl border px-4 py-3">
                  <div className="text-xs text-neutral-500">Remaining</div>
                  <div className="text-2xl font-semibold">{Math.max(0, picksAllowed - picksUsed)}</div>
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
                  <Link href={`/picks?leagueId=${leagueId}&season=${season}&week=${week}`} className="text-sm underline">
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
                  {games.map((g) => (
                    <GameCard key={g.id} game={g as unknown as GameCardGame} teamIndex={teamIndex} />
                  ))}
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
                <Link href={`/picks?leagueId=${leagueId}&season=${season}&week=${week}`} className="text-xs underline">
                  Edit on Picks →
                </Link>
              }
            >
              {myPicks.length === 0 ? (
                <div className="text-sm text-neutral-500">No picks yet.</div>
              ) : (
                <ul className="grid gap-2">
                  {myPicks.map((p) => {
                    const g = p.game_id ? gameById.get(p.game_id!) : undefined
                    const s = (g?.status || (gameLocked(g) ? 'LIVE' : 'UPCOMING')).toUpperCase()
                    const pts = pickPointsForGame(p.team_id, g)
                    return (
                      <li key={p.id} className="flex items-center justify-between">
                        <span>
                          <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 dark:bg-neutral-800 px-3 py-1 text-sm">
                            <span className="font-semibold">{teamIndex[p.team_id]?.abbreviation || '—'}</span>
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          {typeof pts === 'number' && <span className="text-[10px] font-bold">{pts} pts</span>}
                          <span className="text-[10px] uppercase tracking-wide text-neutral-500">{s}</span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            {/* League picks (locked only) */}
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
                          m.picks.map((pk, idx) => (
                            <span key={`${m.profile_id}-${idx}`}>
                              <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 dark:bg-neutral-800 px-3 py-1 text-sm">
                                <span className="font-semibold">{teamIndex[pk.team_id]?.abbreviation || '—'}</span>
                              </span>
                            </span>
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

            {/* Standings (mini) */}
            <Card
              title="Standings (mini)"
              right={
                <Link href={`/standings?leagueId=${leagueId}&season=${season}`} className="text-xs underline">
                  Full standings →
                </Link>
              }
            >
              {standRows.length === 0 ? (
                <div className="text-sm text-neutral-500">No standings yet.</div>
              ) : (
                <ol className="grid gap-2">
                  {standRows.map((r: any, idx: number) => (
                    <li key={r.profile_id || r.id || idx} className="flex items-center justify-between">
                      <span className="truncate">{r.display_name || r.name || r.email || 'Member'}</span>
                      <span className="text-sm font-semibold">{r.points_total ?? 0} pts</span>
                    </li>
                  ))}
                </ol>
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
