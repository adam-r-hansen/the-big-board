'use client'

// app/page.tsx
/**
 * Home:
 *  - Defaults NFL week by Tue→Mon boundaries.
 *  - Never blocks UI on optional endpoints.
 *  - Renders games even if /api/teams is missing.
 */

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import GameCard, { type GameCardGame } from '@/components/ui/GameCard'
import AdminNavLink from '@/components/AdminNavLink'
import { createClient as createSupabaseClient } from '@/utils/supabase/client'

// —————————————————————————————————————————————————————
// Tiny util (replaces '@/lib/utils')
// —————————————————————————————————————————————————————
function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

// —————————————————————————————————————————————————————
// Types (kept loose / defensive around API responses)
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
type TeamLike = Partial<Team> & {
  ui_light_color_key?: string | null
  ui_dark_color_key?: string | null
}
type Game = {
  id: string
  week: number
  game_utc?: string | null
  status?: 'UPCOMING' | 'LIVE' | 'FINAL' | string
  home: { id?: string; abbr?: string | null; abbreviation?: string | null; score?: number | null; name?: string | null; logo?: string | null }
  away: { id?: string; abbr?: string | null; abbreviation?: string | null; score?: number | null; name?: string | null; logo?: string | null }
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
// Small UI: Card
// —————————————————————————————————————————————————————
function Card(props: { title: string; right?: ReactNode; className?: string; children: ReactNode }) {
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
      abbreviation: x.home?.abbreviation ?? x.home_abbr ?? null,
      score: x.home_score ?? x.home?.score ?? null,
      name: x.home?.name ?? null,
      logo: x.home?.logo ?? null,
    },
    away: {
      id: x.away_id ?? x.away?.id ?? x.awayTeamId ?? x.away_abbr ?? x.away?.abbr ?? x.away?.abbreviation ?? null,
      abbr: x.away_abbr ?? x.away?.abbr ?? x.away?.abbreviation ?? null,
      abbreviation: x.away?.abbreviation ?? x.away_abbr ?? null,
      score: x.away_score ?? x.away?.score ?? null,
      name: x.away?.name ?? null,
      logo: x.away?.logo ?? null,
    },
  }))
}

// Use teams map for right-side pills
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
      if (t.id) m[t.id] = v
      if (t.abbreviation) {
        m[t.abbreviation] = v
        m[t.abbreviation.toUpperCase()] = v
      }
    }
    return m
  }, [teamMap])
}

// Minimal team index for GameCard (works without /api/teams)
type TeamForCard = {
  id: string
  abbreviation: string | null
  name: string | null
  color_primary: string | null
  color_secondary: string | null
  logo: string | null
  logo_dark: string | null
}
function buildTeamIndexForCard(teamMap: Record<string, Team>, games: Game[]): Record<string, TeamForCard> {
  const m: Record<string, TeamForCard> = {}

  // 1) seed from teams (when available)
  for (const t of Object.values(teamMap || {})) {
    if (!t?.id) continue
    const v: TeamForCard = {
      id: t.id,
      abbreviation: t.abbreviation ?? null,
      name: t.name ?? null,
      color_primary: t.color_primary ?? null,
      color_secondary: t.color_secondary ?? null,
      logo: t.logo ?? null,
      logo_dark: t.logo_dark ?? null,
    }
    m[t.id] = v
    if (t.abbreviation) {
      m[t.abbreviation] = v
      m[t.abbreviation.toUpperCase()] = v
    }
  }

  // 2) augment from games (if teams endpoint is missing)
  for (const g of games || []) {
    for (const side of [g.home, g.away]) {
      const id = side.id || ''
      const ab = (side.abbr || side.abbreviation || '') as string
      const key = id || ab
      if (!key) continue
      if (m[key]) continue
      const v: TeamForCard = {
        id: id || ab || '',
        abbreviation: (ab || null) as string | null,
        name: (side.name ?? null) as string | null,
        color_primary: null,
        color_secondary: null,
        logo: (side.logo ?? null) as string | null,
        logo_dark: null,
      }
      m[v.id] = v
      if (v.abbreviation) {
        m[v.abbreviation] = v
        m[v.abbreviation.toUpperCase()] = v
      }
    }
  }

  return m
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
  const [games, setGames] = useState<Game[]>([])
  const [myPicks, setMyPicks] = useState<Pick[]>([])
  const [wrinkleExtra, setWrinkleExtra] = useState<number>(0)

  const [leagueLocked, setLeagueLocked] = useState<MemberLockedPicks[]>([])
  const [standRows, setStandRows] = useState<any[]>([])

  const [authReady, setAuthReady] = useState(false)

  const teamIndexLoose = useTeamIndex(teamMap) // right side chips, etc.
  const teamIndexForCard = useMemo(() => buildTeamIndexForCard(teamMap, games), [teamMap, games])

  const singleLeague = leagues.length === 1
  const noLeagues = leagues.length === 0

  // derived
  const picksUsed = myPicks.length
  const picksAllowed = 2 + (wrinkleExtra || 0)
  const picksLocked = myPicks.filter((p) => p.status === 'FINAL' || p.status === 'LIVE').length
  const weekPoints = myPicks.reduce((acc, p) => acc + (typeof p.points === 'number' ? p.points : 0), 0)

  // ——— Auth callback cleanup + ready flag ———
  useEffect(() => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    ;(async () => {
      try {
        if (code) {
          const supabase = createSupabaseClient()
          await supabase.auth.exchangeCodeForSession(code)
          // strip auth params
          const AUTH_PARAMS = ['code','type','scope','auth_callback','next','redirect_to','provider','refresh_token','access_token']
          const clean = new URL(window.location.href)
          AUTH_PARAMS.forEach((p) => clean.searchParams.delete(p))
          window.history.replaceState({}, '', clean.toString())
        }
      } catch (e) {
        console.error('Auth handling failed', e)
      } finally {
        setAuthReady(true)
      }
    })()
  }, [])

  // 1) Leagues (always)
  useEffect(() => {
    if (!authReady) return
    ;(async () => {
      try {
        const leaguesRes = await fetch('/api/leagues', { cache: 'no-store' })
        if (leaguesRes.ok) {
          const data = await leaguesRes.json()
          const L = Array.isArray(data?.leagues) ? data.leagues : data?.rows || data || []
          setLeagues(L)
          if (L.length === 1) {
            setLeagueId(L[0].id)
            setSeason(L[0].season)
          }
        } else {
          console.warn('/api/leagues failed', leaguesRes.status)
        }
      } catch (e) {
        console.error('Load leagues failed', e)
      }
    })()
  }, [authReady])

  // 2) Games (by season/week) — independent of league
  useEffect(() => {
    if (!authReady) return
    ;(async () => {
      try {
        const res = await fetch(`/api/games-for-week?season=${season}&week=${week}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setGames(normalizeGames(data?.games || data || []))
        } else {
          console.warn('/api/games-for-week failed', res.status)
          setGames([])
        }
      } catch (e) {
        console.error('Load games failed', e)
        setGames([])
      }
    })()
  }, [authReady, season, week])

  // 3) Teams (optional) — try a couple of likely endpoints, but NEVER block UI
  useEffect(() => {
    if (!authReady) return
    ;(async () => {
      const tryEndpoints = ['/api/teams', '/api/team-index', '/api/teams-index']
      for (const url of tryEndpoints) {
        try {
          const r = await fetch(url, { cache: 'no-store' })
          if (!r.ok) {
            console.warn(`${url} failed`, r.status)
            continue
          }
          const data = await r.json()
          const teamsArr = Array.isArray(data?.teams) ? data.teams : Array.isArray(data) ? data : []
          if (teamsArr.length === 0) continue
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
          return
        } catch (e) {
          console.warn('teams fetch error', e)
        }
      }
      // If all endpoints fail, leave teamMap empty (GameCard will use game-derived fallback).
      setTeamMap((m) => m || {})
    })()
  }, [authReady])

  // 4) My Picks (ONLY when leagueId exists; include leagueId)
  useEffect(() => {
    if (!authReady || !leagueId) {
      setMyPicks([])
      return
    }
    ;(async () => {
      try {
        const url = `/api/my-picks?leagueId=${encodeURIComponent(leagueId)}&season=${season}&week=${week}`
        const res = await fetch(url, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          const pArr = Array.isArray(data?.picks) ? data.picks : Array.isArray(data) ? data : []
          setMyPicks(pArr)
        } else {
          console.warn('/api/my-picks failed', res.status)
          setMyPicks([])
        }
      } catch (e) {
        console.error('Load my picks failed', e)
        setMyPicks([])
      }
    })()
  }, [authReady, leagueId, season, week])

  // 5) Wrinkles + Standings (ONLY with leagueId)
  useEffect(() => {
    if (!authReady || !leagueId) {
      setWrinkleExtra(0)
      setStandRows([])
      setLeagueLocked([])
      return
    }
    ;(async () => {
      try {
        const [wRes, sRes] = await Promise.all([
          fetch(`/api/wrinkles?leagueId=${leagueId}`, { cache: 'no-store' }),
          fetch(`/api/standings?leagueId=${leagueId}&season=${season}`, { cache: 'no-store' }),
        ])

        if (wRes.ok) {
          const w = await wRes.json()
          const extra = Array.isArray(w?.wrinkles)
            ? w.wrinkles.reduce((acc: number, it: any) => acc + (Number(it?.extra_picks) || 0), 0)
            : 0
          setWrinkleExtra(extra)
        } else {
          setWrinkleExtra(0)
        }

        if (sRes.ok) {
          const s = await sRes.json()
          const rows = Array.isArray(s) ? s : (s?.standings || s?.rows || [])
          setStandRows(rows || [])
          // If your standings payload includes per-member locked picks, you can wire them here.
        } else {
          setStandRows([])
        }
      } catch (e) {
        console.error('Load wrinkles/standings failed', e)
        setWrinkleExtra(0)
        setStandRows([])
      }
    })()
  }, [authReady, leagueId, season])

  // Default the week based on NFL Tue→Mon boundaries (don’t override manual pick)
  useEffect(() => {
    if (userPickedWeek) return
    const computed = currentNflWeekForSeason(season, new Date())
    if (computed !== week) setWeek(computed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season])

  // ——— Render ———
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">NFL Pick’em</h1>
        <div className="flex items-center gap-2">
          <AdminNavLink />
        </div>
      </header>

      {/* Filters */}
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
            onChange={(e) => setSeason(Number(e.target.value))}
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
            <Card
              title="League overview"
              right={
                leagueId ? (
                  <Link href={`/picks?leagueId=${leagueId}&season=${season}&week=${week}`} className="text-sm underline">
                    Make picks →
                  </Link>
                ) : null
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

            <Card
              title={`Week ${week} — Games`}
              right={
                <div className="flex items-center gap-3">
                  {leagueId && (
                    <Link href={`/picks?leagueId=${leagueId}&season=${season}&week=${week}`} className="text-sm underline">
                      Make picks →
                    </Link>
                  )}
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
                    <GameCard key={g.id} game={g as unknown as GameCardGame} teamIndex={teamIndexForCard as any} />
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT 1/3 */}
          <aside className="lg:col-span-4 grid gap-6">
            <Card
              title={`My picks — Week ${week}`}
              right={
                leagueId ? (
                  <Link href={`/picks?leagueId=${leagueId}&season=${season}&week=${week}`} className="text-xs underline">
                    Edit on Picks →
                  </Link>
                ) : null
              }
            >
              {!leagueId ? (
                <div className="text-sm text-neutral-500">Select a league to view your picks.</div>
              ) : myPicks.length === 0 ? (
                <div className="text-sm text-neutral-500">No picks yet.</div>
              ) : (
                <ul className="grid gap-2">
                  {myPicks.map((p) => {
                    const g = games.find((gg) => gg.id === p.game_id)
                    const s = (g?.status || (gameLocked(g) ? 'LIVE' : 'UPCOMING')).toUpperCase()
                    const pts = pickPointsForGame(p.team_id, g)
                    const teamMeta = teamIndexLoose[p.team_id]
                    const abbr = (teamMeta?.abbreviation as string) || '—'
                    return (
                      <li key={p.id} className="flex items-center justify-between">
                        <span>
                          <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 dark:bg-neutral-800 px-3 py-1 text-sm">
                            <span className="font-semibold">{abbr}</span>
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

            <Card
              title="Standings (mini)"
              right={
                leagueId ? (
                  <Link href={`/standings?leagueId=${leagueId}&season=${season}`} className="text-xs underline">
                    Full standings →
                  </Link>
                ) : null
              }
            >
              {!leagueId ? (
                <div className="text-sm text-neutral-500">Select a league to view standings.</div>
              ) : standRows.length === 0 ? (
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
