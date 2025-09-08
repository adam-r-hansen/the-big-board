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
  home: { id?: string; score?: number | null }
  away: { id?: string; score?: number | null }
}
type PickRow = { id: string; team_id: string; game_id: string | null }

// --- small helpers ----------------------------------------------------------
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

function normalizeGames(rows: any[]): Game[] {
  return (rows || []).map((x: any) => ({
    id: x.id,
    season: x.season,
    week: x.week,
    game_utc: x.game_utc || x.start_time,
    status: x.status ?? 'UPCOMING',
    home: {
      id: x.home?.id ?? x.home_team ?? x.homeTeamId ?? x.home_team_id,
      score: x.home_score ?? x.home?.score ?? null,
    },
    away: {
      id: x.away?.id ?? x.away_team ?? x.awayTeamId ?? x.away_team_id,
      score: x.away_score ?? x.away?.score ?? null,
    },
  }))
}

function isLocked(g?: Game) {
  if (!g) return false
  const s = (g.status || '').toUpperCase()
  if (s === 'FINAL' || s === 'LIVE') return true
  if (!g.game_utc) return false
  return new Date(g.game_utc) <= new Date()
}

function url(path: string, params: Record<string, string | number | undefined>) {
  const usp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) usp.set(k, String(v))
  })
  return usp.toString() ? `${path}?${usp}` : path
}

// --- page shell -------------------------------------------------------------
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="mb-3 text-xl font-bold">NFL Pick’em</h1>
          <div className="text-neutral-600">Loading…</div>
        </main>
      }
    >
      <HomeInner />
    </Suspense>
  )
}

function HomeInner() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number>(1)

  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})
  const teamIndex = useMemo(() => buildTeamIndex(teamMap), [teamMap])

  const [games, setGames] = useState<Game[]>([])
  const [myPicks, setMyPicks] = useState<PickRow[]>([])
  const [lockedByMember, setLockedByMember] = useState<any[]>([])
  const [msg, setMsg] = useState<string>('')

  // Initial parallel fetch
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [lj, tm] = await Promise.all([
          fetch('/api/my-leagues', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ leagues: [] })),
          fetch('/api/team-map', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        ])
        if (cancelled) return
        const ls: League[] = lj?.leagues || []
        setLeagues(ls)
        // prefer first league; if empty, we’ll still load week data using server defaults
        if (!leagueId && ls[0]) {
          setLeagueId(ls[0].id)
          setSeason(ls[0].season)
        }
        setTeamMap(tm?.teams || {})
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message || 'Failed to bootstrap page')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load week data (leagueId optional)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setMsg('')
        const [g, p, lp] = await Promise.all([
          fetch(url('/api/games-for-week', { season, week }), { cache: 'no-store' }).then(r => r.json()),
          fetch(url('/api/my-picks', { leagueId: leagueId || undefined, season, week }), {
            cache: 'no-store',
          }).then(r => r.json()),
          // If the endpoint doesn’t exist, this will safely no-op.
          fetch(url('/api/league/locked-picks', { leagueId: leagueId || undefined, season, week }), {
            cache: 'no-store',
          })
            .then(r => (r.ok ? r.json() : { picks: [] }))
            .catch(() => ({ picks: [] })),
        ])

        if (cancelled) return
        const gamesNorm = normalizeGames(g?.games || g || [])
        setGames(gamesNorm)
        // If API returns current week in payload, sync it
        if (gamesNorm[0]?.week && gamesNorm[0].week !== week) setWeek(gamesNorm[0].week)

        setMyPicks((p?.picks || []).map((r: any) => ({ id: r.id, team_id: r.team_id, game_id: r.game_id })))
        setLockedByMember(lp?.picks || [])
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message || 'Failed to load data')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [leagueId, season, week])

  const gameById = useMemo(() => {
    const m = new Map<string, Game>()
    for (const g of games) m.set(g.id, g)
    return m
  }, [games])

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">NFL Pick’em</h1>
        <div className="flex items-center gap-3">
          {leagues.length > 1 && (
            <select
              className="rounded border bg-transparent px-2 py-1"
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
            >
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
          <select
            className="rounded border bg-transparent px-2 py-1"
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
            className="rounded border bg-transparent px-2 py-1"
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
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN ------------------------------------------------------- */}
        <div className="grid gap-6 lg:col-span-8">
          <Card
            title="League overview"
            right={
              <Link href="/picks" className="text-sm underline">
                Make picks →
              </Link>
            }
          >
            <div className="text-sm text-neutral-500">
              Your quick snapshot for Week {week}. View full details on the{' '}
              <Link href="/standings" className="underline">
                Standings
              </Link>{' '}
              page.
            </div>
          </Card>

          <Card
            title={`Week ${week} — Games`}
            right={
              <div className="flex items-center gap-4">
                <Link href="/picks" className="text-sm underline">
                  Make picks →
                </Link>
                <Link href="/scoreboard" className="text-sm underline">
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
                  const final = (g.status || '').toUpperCase() === 'FINAL'
                  const homeWon = final && (Number(g.home.score) ?? -1) > (Number(g.away.score) ?? -1)
                  const awayWon = final && (Number(g.away.score) ?? -1) > (Number(g.home.score) ?? -1)

                  return (
                    <article
                      key={g.id}
                      className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
                    >
                      <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
                        <span>
                          {g.game_utc ? new Date(g.game_utc).toLocaleString() : ''} • Week {g.week}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide">
                          {(g.status || (isLocked(g) ? 'LIVE' : 'UPCOMING')).toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="flex-1">
                          <TeamPill
                            teamId={g.home.id}
                            teamIndex={teamIndex}
                            size="sm"
                            mdUpSize="xl"
                            fluid
                            variant="subtle"
                            labelMode="abbrNick"
                            selected={!!homeWon}
                          />
                        </div>
                        <div className="text-neutral-400">—</div>
                        <div className="flex-1">
                          <TeamPill
                            teamId={g.away.id}
                            teamIndex={teamIndex}
                            size="sm"
                            mdUpSize="xl"
                            fluid
                            variant="subtle"
                            labelMode="abbrNick"
                            selected={!!awayWon}
                          />
                        </div>
                      </div>

                      {(g.home.score != null || g.away.score != null) && (
                        <div className="mt-2 text-xs text-neutral-500">
                          Score: {g.home.score ?? '—'} — {g.away.score ?? '—'}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN ------------------------------------------------------ */}
        <aside className="grid gap-6 lg:col-span-4">
          <Card
            title={`My picks — Week ${week}`}
            right={
              <Link href="/picks" className="text-sm underline">
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
                  const status = (g?.status || (isLocked(g) ? 'LIVE' : 'UPCOMING')).toUpperCase()
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-3">
                      <TeamPill
                        teamId={p.team_id}
                        teamIndex={teamIndex}
                        size="sm"
                        mdUpSize="lg"
                        fixedWidth
                        variant="subtle"
                        labelMode="abbrNick"
                        selected
                      />
                      <span className="text-xs text-neutral-500">{status}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card title="League picks (locked)" right={<span className="text-xs opacity-70">Finals only</span>}>
            {lockedByMember.length === 0 ? (
              <div className="text-sm text-neutral-500">No locked picks yet.</div>
            ) : (
              <ul className="grid gap-3">
                {lockedByMember.map((row: any) => (
                  <li key={`${row.profile_id}-${row.team_id}`} className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">{row.display_name}</div>
                    <TeamPill
                      teamId={row.team_id}
                      teamIndex={teamIndex}
                      size="sm"
                      mdUpSize="lg"
                      fixedWidth
                      variant="subtle"
                      labelMode="abbrNick"
                      selected
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      {msg && <div className="mt-2 text-xs">{msg}</div>}
    </main>
  )
}
