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
type MemberPick = { profile_id: string; display_name: string; team_id: string; game_id?: string | null }

const safeJson = async <T,>(p: Promise<Response>): Promise<T | null> => {
  try {
    const r = await p
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  }
}

const normalizeGames = (rows: any[] = []): Game[] =>
  rows.map((x: any) => ({
    id: x.id,
    season: x.season,
    week: x.week,
    game_utc: x.game_utc || x.start_time,
    status: x.status ?? 'UPCOMING',
    home: { id: x.home?.id ?? x.home_team ?? x.homeTeamId ?? x.home_team_id, score: x.home_score ?? x.home?.score ?? null },
    away: { id: x.away?.id ?? x.away_team ?? x.awayTeamId ?? x.away_team_id, score: x.away_score ?? x.away?.score ?? null },
  }))

const isLocked = (g?: Game) => {
  if (!g) return false
  const s = (g.status || '').toUpperCase()
  if (s === 'FINAL' || s === 'LIVE') return true
  if (!g.game_utc) return false
  return new Date(g.game_utc) <= new Date()
}

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
  const pad = dense ? 'p-2 md:p-3' : 'p-4 md:p-5'
  const head = dense ? 'mb-1.5' : 'mb-3'
  const titleCls = dense ? 'text-base font-semibold' : 'text-lg font-semibold'
  return (
    <section className={`rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 ${pad} ${className}`}>
      <header className={`flex items-center justify-between ${head}`}>
        <h2 className={titleCls}>{title}</h2>
        {right}
      </header>
      {children}
    </section>
  )
}

function SkeletonPill() {
  return <div className="h-9 w-full rounded-full border border-neutral-200 dark:border-neutral-800 animate-pulse bg-neutral-50/40 dark:bg-neutral-800" />
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="mb-3 text-2xl font-bold">NFL Pick’em</h1>
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
  const teamIndex = useMemo(() => buildTeamIndex(teamMap as any), [teamMap])
  const colorsReady = useMemo(() => Object.keys(teamIndex).length > 0, [teamIndex])

  const [games, setGames] = useState<Game[]>([])
  const [myPicks, setMyPicks] = useState<PickRow[]>([])
  const [lockedByMember, setLockedByMember] = useState<MemberPick[]>([])
  const [wrinkleExtra, setWrinkleExtra] = useState<number>(0)
  const [weekPoints, setWeekPoints] = useState<number | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    ;(async () => {
      const lj = await safeJson<{ leagues: League[] }>(fetch('/api/my-leagues', { cache: 'no-store' }))
      const tm = await safeJson<{ teams: Record<string, Team> }>(fetch('/api/team-map', { cache: 'no-store' }))
      const ls = lj?.leagues || []
      setLeagues(ls)
      if (!leagueId && ls[0]) {
        setLeagueId(ls[0].id)
        setSeason(ls[0].season)
      }
      setTeamMap(tm?.teams || {})
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!season || !week) return
    ;(async () => {
      setMsg('')
      try {
        const [gRaw, pRaw, wRaw, ptsRaw] = await Promise.all([
          safeJson<any>(fetch(`/api/games-for-week?season=${season}&week=${week}`, { cache: 'no-store' })),
          safeJson<any>(fetch(`/api/my-picks?leagueId=${leagueId || ''}&season=${season}&week=${week}`, { cache: 'no-store' })),
          safeJson<any>(fetch(`/api/wrinkles/active?leagueId=${leagueId || ''}&season=${season}&week=${week}`, { cache: 'no-store' })),
          safeJson<any>(fetch(`/api/stats/my-week?leagueId=${leagueId || ''}&season=${season}&week=${week}`, { cache: 'no-store' })),
        ])

        const gamesNorm = normalizeGames(gRaw?.games || gRaw || [])
        setGames(gamesNorm)
        if (gamesNorm[0]?.week && gamesNorm[0].week !== week) setWeek(gamesNorm[0].week)

        setMyPicks((pRaw?.picks || []).map((r: any) => ({ id: r.id, team_id: r.team_id, game_id: r.game_id })))

        const extra = Array.isArray((wRaw as any)?.wrinkles)
          ? (wRaw as any).wrinkles.reduce((acc: number, it: any) => acc + (Number(it?.extra_picks) || 0), 0)
          : 0
        setWrinkleExtra(extra)

        const pts =
          Number(ptsRaw?.summary?.points_total) ??
          (typeof ptsRaw?.points_total === 'number' ? ptsRaw.points_total : null)
        setWeekPoints(Number.isFinite(pts as number) ? (pts as number) : null)

        // locked picks (robust)
        const finals = new Set(gamesNorm.filter(isLocked).map((gm) => gm.id))
        let locked: MemberPick[] = []
        const direct = await safeJson<any>(
          fetch(`/api/league/locked-picks?leagueId=${leagueId || ''}&season=${season}&week=${week}`, { cache: 'no-store' }),
        )
        if (direct?.picks?.length) {
          locked = (direct.picks as any[]).map((row) => ({
            profile_id: row.profile_id || row.user_id || row.id || `${row.display_name}`,
            display_name: row.display_name || row.member || row.name || 'Member',
            team_id: row.team_id || row.team || row.tid,
            game_id: row.game_id ?? null,
          }))
        } else {
          const all = await safeJson<any>(
            fetch(`/api/league/picks?leagueId=${leagueId || ''}&season=${season}&week=${week}`, { cache: 'no-store' }),
          )
          const rows: any[] = (all?.picks as any[]) || (all?.rows as any[]) || (Array.isArray(all) ? all : []) || []
          locked = rows
            .filter((r) => finals.has(r.game_id))
            .map((r) => ({
              profile_id: r.profile_id || r.user_id || r.id || `${r.display_name}`,
              display_name: r.display_name || r.member || r.name || 'Member',
              team_id: r.team_id || r.team || r.tid,
              game_id: r.game_id ?? null,
            }))
        }
        const dedup = new Map<string, MemberPick>()
        for (const row of locked) dedup.set(row.profile_id, row)
        setLockedByMember([...dedup.values()])
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

  const picksAllowed = 2 + (wrinkleExtra || 0)
  const picksUsed = myPicks.length
  const picksLeft = Math.max(0, picksAllowed - picksUsed)
  const picksLocked = myPicks.reduce((acc, p) => acc + (isLocked(p.game_id ? gameById.get(p.game_id) : undefined) ? 1 : 0), 0)

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">NFL Pick’em</h1>
        <div className="flex items-center gap-3">
          {leagues.length > 1 && (
            <select className="rounded border bg-transparent px-2 py-1" value={leagueId} onChange={(e) => setLeagueId(e.target.value)}>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
          <select className="rounded border bg-transparent px-2 py-1" value={season} onChange={(e) => setSeason(Number(e.target.value))}>
            {Array.from({ length: 3 }).map((_, i) => {
              const yr = new Date().getFullYear() - 1 + i
              return (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              )
            })}
          </select>
          <select className="rounded border bg-transparent px-2 py-1" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* LEFT */}
        <div className="grid gap-4 lg:col-span-8">
          <Card title="League overview" right={<Link href="/picks" className="text-sm underline">Make picks →</Link>}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
                <div className="text-xs text-neutral-500">Picks used</div>
                <div className="text-2xl font-semibold">{picksUsed}</div>
                <div className="text-xs text-neutral-500">of {picksAllowed}</div>
              </div>
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
                <div className="text-xs text-neutral-500">Points (wk)</div>
                <div className="text-2xl font-semibold">{weekPoints != null ? weekPoints : '—'}</div>
              </div>
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
                <div className="text-xs text-neutral-500">Remaining</div>
                <div className="text-2xl font-semibold">{picksLeft}</div>
              </div>
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
                <div className="text-xs text-neutral-500">Locked</div>
                <div className="text-2xl font-semibold">{picksLocked}</div>
              </div>
            </div>
          </Card>

          <Card
            title={`Week ${week} — Games`}
            right={
              <div className="flex items-center gap-4">
                <Link href="/picks" className="text-sm underline">Make picks →</Link>
                <Link href="/scoreboard" className="text-sm underline">Scoreboard →</Link>
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
                    <article key={g.id} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                      <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
                        <span>{g.game_utc ? new Date(g.game_utc).toLocaleString() : ''} • Week {g.week}</span>
                        <span className="text-[10px] uppercase tracking-wide">{(g.status || (isLocked(g) ? 'LIVE' : 'UPCOMING')).toUpperCase()}</span>
                      </div>

                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="flex-1">
                          {colorsReady ? (
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
                          ) : (
                            <SkeletonPill />
                          )}
                        </div>
                        <div className="text-neutral-400">—</div>
                        <div className="flex-1">
                          {colorsReady ? (
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
                          ) : (
                            <SkeletonPill />
                          )}
                        </div>
                      </div>

                      {(g.home.score != null || g.away.score != null) && (
                        <div className="mt-2 text-xs text-neutral-500">Score: {g.home.score ?? '—'} — {g.away.score ?? '—'}</div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT — dense */}
        <aside className="grid gap-2 lg:col-span-4">
          <Card
            title={`My picks — Week ${week}`}
            right={<Link href="/picks" className="text-xs underline">Edit on Picks →</Link>}
            dense
          >
            {myPicks.length === 0 ? (
              <div className="text-sm text-neutral-500">No picks yet.</div>
            ) : (
              <ul className="grid gap-1.5">
                {myPicks.map((p) => {
                  const g = p.game_id ? gameById.get(p.game_id) : undefined
                  const status = (g?.status || (isLocked(g) ? 'LIVE' : 'UPCOMING')).toUpperCase()
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      {colorsReady ? (
                        <TeamPill
                          teamId={p.team_id}
                          teamIndex={teamIndex}
                          size="sm"
                          mdUpSize="sm"
                          fixedWidth
                          variant="pill"
                          labelMode="abbrNick"
                          selected
                        />
                      ) : (
                        <SkeletonPill />
                      )}
                      <span className="text-[10px] text-neutral-500">{status}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card title="League picks (locked)" right={<span className="text-[10px] opacity-70">Finals only</span>} dense>
            {lockedByMember.length === 0 ? (
              <div className="text-sm text-neutral-500">No locked picks yet.</div>
            ) : (
              <ul className="grid gap-1.5">
                {lockedByMember.map((row) => (
                  <li key={`${row.profile_id}-${row.team_id}`} className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm">{row.display_name}</div>
                    {colorsReady ? (
                      <TeamPill
                        teamId={row.team_id}
                        teamIndex={teamIndex}
                        size="sm"
                        mdUpSize="sm"
                        fixedWidth
                        variant="pill"
                        labelMode="abbrNick"
                        selected
                      />
                    ) : (
                      <SkeletonPill />
                    )}
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
