'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TeamPill from '@/components/ui/TeamPill'
import useTeamIndex from '@/hooks/useTeamIndex'
import { buildTeamIndex, type Team as TeamType } from '@/lib/teamColors'

type League = { id: string; name: string; season: number }
type Game = {
  id: string
  season: number
  week: number
  game_utc?: string
  status?: string
  home: { id?: string; score?: number | null }
  away: { id?: string; score?: number | null }
}
type PickRow = { id: string; team_id: string; game_id: string | null; display_name?: string }
type StandRow = { display_name: string; points_total?: number; avg_points_per_pick?: number }

function Card({
  children,
  title,
  right,
  className = '',
  dense = false,
}: {
  children: React.ReactNode
  title: string
  right?: React.ReactNode
  className?: string
  dense?: boolean
}) {
  return (
    <section
      className={[
        'rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900',
        dense ? 'p-3 md:p-4' : 'p-4 md:p-5',
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
    status: (x.status || '').toUpperCase() || 'UPCOMING',
    home: { id: x.home?.id ?? x.home_team ?? x.home_team_id, score: x.home_score ?? x.home?.score ?? null },
    away: { id: x.away?.id ?? x.away_team ?? x.away_team_id, score: x.away_score ?? x.away?.score ?? null },
  }))
}
const gameLocked = (g?: Game) => {
  if (!g) return false
  const s = (g.status || '').toUpperCase()
  if (s === 'FINAL' || s === 'LIVE') return true
  if (!g.game_utc) return false
  return new Date(g.game_utc) <= new Date()
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-xl font-bold">NFL Pick’em</h1>
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

  // Admin color source of truth
  const teamIndex = useTeamIndex()

  // Data
  const [games, setGames] = useState<Game[]>([])
  const [myPicks, setMyPicks] = useState<PickRow[]>([])
  const [leaguePicks, setLeaguePicks] = useState<PickRow[]>([])
  const [standings, setStandings] = useState<StandRow[]>([])
  const [msg, setMsg] = useState<string>('')

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
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // per-week
  useEffect(() => {
    if (!leagueId || !season || !week) return
    ;(async () => {
      setMsg('')
      try {
        const [g, p, lp, st] = await Promise.all([
          fetch(`/api/games-for-week?season=${season}&week=${week}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
          fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
          // generic league picks (we’ll filter to finals on the client)
          fetch(`/api/league-picks?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
          // standings snapshot (any endpoint; fallback shape handled below)
          fetch(`/api/standings?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        ])

        setGames(normalizeGames(g?.games || g || []))
        setMyPicks((p?.picks || []).map((r: any) => ({ id: r.id, team_id: r.team_id, game_id: r.game_id })))

        // league picks (flatten common shapes)
        const lpRows: any[] = lp?.picks || lp?.log || lp || []
        setLeaguePicks(
          (Array.isArray(lpRows) ? lpRows : []).map((r: any) => ({
            id: r.id || `${r.profile_id || ''}-${r.team_id || ''}-${r.game_id || ''}`,
            team_id: r.team_id,
            game_id: r.game_id,
            display_name: r.display_name || r.name || r.user || r.profile?.display_name || '',
          }))
        )

        // mini-standings: prefer ranking by points_total, fall back to avg points
        const leaders: any[] =
          st?.leaders?.avg_points_per_pick ||
          st?.leaders?.points ||
          st?.leaders ||
          st?.standings ||
          st?.rows ||
          []
        setStandings(
          leaders
            .map((x: any) => ({
              display_name: x.display_name || x.name || x.profile?.display_name || '',
              points_total: Number(x.points_total ?? x.points ?? 0),
              avg_points_per_pick: Number(x.avg_points_per_pick ?? 0),
            }))
            .sort((a, b) => (b.points_total ?? 0) - (a.points_total ?? 0))
            .slice(0, 10)
        )
      } catch (e: any) {
        setMsg(e?.message || 'Failed to load data')
      }
    })()
  }, [leagueId, season, week])

  const gameById = useMemo(() => {
    const m = new Map<string, Game>()
    for (const g of games) m.set(g.id, g)
    return m
  }, [games])

  // Finals-only league picks
  const lockedPicks = useMemo(() => {
    return leaguePicks.filter((p) => {
      const g = p.game_id ? gameById.get(p.game_id) : undefined
      return gameLocked(g)
    })
  }, [leaguePicks, gameById])

  const pickedTeamIdForGame = (gameId: string) => myPicks.find(p => p.game_id === gameId)?.team_id

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <section className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">NFL Pick’em</h1>

        <div className="ml-auto flex items-center gap-3">
          <Link className="underline text-sm" href="/picks">Picks</Link>
          <Link className="underline text-sm" href="/scoreboard">Scoreboard</Link>
          <Link className="underline text-sm" href="/standings">Standings</Link>

          {/* Season & Week selectors */}
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

          <select
            className="border rounded px-2 py-1 bg-transparent"
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
          >
            {Array.from({ length: 18 }).map((_, i) => {
              const wk = i + 1
              return <option key={wk} value={wk}>{wk}</option>
            })}
          </select>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-8 grid gap-6">
          <Card
            title="League overview"
            right={<Link href="/standings" className="text-sm underline">Make picks →</Link>}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBox label="Picks used" value={myPicks.length} sub="of 3" />
              <StatBox label="Points (wk)" value="—" />
              <StatBox label="Remaining" value={Math.max(0, 3 - myPicks.length)} />
              <StatBox label="Locked" value={games.filter(g => gameLocked(g)).length} />
            </div>
          </Card>

          <Card
            title={`Week ${week} — Games`}
            right={
              <div className="flex items-center gap-4 text-sm">
                <Link href="/picks" className="underline">Make picks →</Link>
                <Link href="/scoreboard" className="underline">Scoreboard →</Link>
              </div>
            }
          >
            {games.length === 0 ? (
              <div className="text-sm text-neutral-500">No games.</div>
            ) : (
              <div className="grid gap-4">
                {games.map((g) => {
                  const picked = pickedTeamIdForGame(g.id)
                  return (
                    <article
                      key={g.id}
                      className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
                        <span>{g.game_utc ? new Date(g.game_utc).toLocaleString() : ''} • Week {g.week}</span>
                        <span className="text-[10px] uppercase tracking-wide">{(g.status || 'UPCOMING').toUpperCase()}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <TeamPill
                            teamId={g.home.id}
                            teamIndex={teamIndex}
                            size="sm"
                            mdUpSize="xl"
                            fluid
                            variant="pill"          // <- Admin colors honored (same as working spot)
                            labelMode="abbrNick"
                            selected={picked === g.home.id}
                            disabled
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
                            variant="pill"
                            labelMode="abbrNick"
                            selected={picked === g.away.id}
                            disabled
                          />
                        </div>
                      </div>
                      {(g.home.score ?? g.away.score) != null && (
                        <div className="mt-2 text-sm text-neutral-500">
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

        {/* RIGHT */}
        <aside className="lg:col-span-4 grid gap-4">
          <Card
            dense
            title={`My picks — Week ${week}`}
            right={<Link href="/picks" className="text-xs underline">Edit on Picks →</Link>}
            className="sticky top-4"
          >
            {myPicks.length === 0 ? (
              <div className="text-sm text-neutral-500">No picks yet.</div>
            ) : (
              <ul className="grid gap-2">
                {myPicks.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3">
                    <TeamPill
                      teamId={p.team_id}
                      teamIndex={teamIndex}
                      size="sm"
                      mdUpSize="lg"
                      variant="chip"
                      labelMode="abbrNick"
                      fixedWidth
                    />
                    <span className="text-[10px] uppercase tracking-wide text-neutral-500">FINAL</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card dense title="League picks (locked)" right={<span className="text-xs text-neutral-500">Finals only</span>}>
            {lockedPicks.length === 0 ? (
              <div className="text-sm text-neutral-500">No locked picks yet.</div>
            ) : (
              <ul className="grid gap-2">
                {lockedPicks.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-neutral-600 truncate">{p.display_name || '—'}</span>
                    <TeamPill teamId={p.team_id} teamIndex={teamIndex} size="sm" variant="chip" labelMode="abbrNick" fixedWidth />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card dense title="Mini standings" right={<Link href="/standings" className="text-xs underline">View all →</Link>}>
            {standings.length === 0 ? (
              <div className="text-sm text-neutral-500">No standings yet.</div>
            ) : (
              <ol className="grid gap-1">
                {standings.slice(0, 10).map((r, i) => (
                  <li key={`${r.display_name}-${i}`} className="flex items-center justify-between">
                    <span className="text-sm truncate">{i + 1}. {r.display_name}</span>
                    <span className="text-sm tabular-nums">{r.points_total ?? 0}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </aside>
      </div>

      {msg && <div className="text-xs mt-2">{msg}</div>}
    </main>
  )
}

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-neutral-500 mt-1">{sub}</div>}
    </div>
  )
}
