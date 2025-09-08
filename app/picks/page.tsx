// app/picks/page.tsx
'use client'

/**
 * Picks page
 * - 2/3 games list (pills are FLUID here to fill space nicely)
 * - 1/3 sidebar with "My picks" (fixed-width pills, consistent with Home)
 * - No API changes; follows POST /api/picks and DELETE /api/picks
 */

import { Suspense, useEffect, useMemo, useState } from 'react'
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

function gameLocked(g?: Game) {
  if (!g) return false
  const s = (g.status || '').toUpperCase()
  if (s === 'FINAL' || s === 'LIVE') return true
  if (!g.game_utc) return false
  return new Date(g.game_utc) <= new Date()
}

export default function PicksPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="mb-3 text-xl font-bold">Picks</h1>
          <div className="text-neutral-600">Loading…</div>
        </main>
      }
    >
      <PicksInner />
    </Suspense>
  )
}

function PicksInner() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number>(1)

  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})
  const teamIndex = useMemo(() => buildTeamIndex(teamMap), [teamMap])

  const [games, setGames] = useState<Game[]>([])
  const [myPicks, setMyPicks] = useState<PickRow[]>([])
  const [wrinkleExtra, setWrinkleExtra] = useState<number>(0)

  const [msg, setMsg] = useState<string>('')

  // initial fetch
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

  // per-week loads
  useEffect(() => {
    if (!leagueId || !season || !week) return
    ;(async () => {
      setMsg('')
      try {
        const [g, p, w] = await Promise.all([
          fetch(`/api/games-for-week?season=${season}&week=${week}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/wrinkles/active?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' })
            .then(r => r.json())
            .catch(() => ({})),
        ])

        setGames(normalizeGames(g?.games || g || []))
        setMyPicks((p?.picks || []).map((r: any) => ({ id: r.id, team_id: r.team_id, game_id: r.game_id })))
        const extra = Array.isArray(w?.wrinkles)
          ? w.wrinkles.reduce((acc: number, it: any) => acc + (Number(it?.extra_picks) || 0), 0)
          : 0
        setWrinkleExtra(extra)
      } catch (e: any) {
        setMsg(e?.message || 'Failed to load data')
      }
    })()
  }, [leagueId, season, week])

  // helpers
  const gameById = useMemo(() => {
    const m = new Map<string, Game>()
    for (const g of games) m.set(g.id, g)
    return m
  }, [games])

  const picksAllowed = 2 + (wrinkleExtra || 0)
  const picksUsed = myPicks.length
  const picksLeft = Math.max(0, picksAllowed - picksUsed)

  const pickedTeamIdForGame = (gameId: string) => {
    const r = myPicks.find(p => p.game_id === gameId)
    return r?.team_id
  }

  async function addPick(game: Game, teamId?: string) {
    if (!leagueId || !teamId) return
    if (gameLocked(game)) {
      setMsg('Game is locked (kickoff passed)')
      return
    }
    // already picked this game? (toggle to that team)
    const existing = myPicks.find(p => p.game_id === game.id)
    if (existing && existing.team_id === teamId) return // already selected

    try {
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId,
          season,
          week,
          teamId,
          gameId: game.id, // required for server-side lock checks
        }),
      })
      const j = await res.json()
      if (!res.ok) {
        setMsg(j?.error || 'Failed to save pick')
      } else {
        // refresh picks
        const p = await fetch(
          `/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`,
          { cache: 'no-store' },
        ).then(r => r.json())
        setMyPicks((p?.picks || []).map((r: any) => ({ id: r.id, team_id: r.team_id, game_id: r.game_id })))
        setMsg('')
      }
    } catch (e: any) {
      setMsg(e?.message || 'Failed to save pick')
    }
  }

  async function removePick(p: PickRow) {
    const g = p.game_id ? gameById.get(p.game_id) : undefined
    if (gameLocked(g)) {
      setMsg('Game is locked (kickoff passed)')
      return
    }
    try {
      const res = await fetch(`/api/picks?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' })
      const j = await res.json()
      if (!res.ok) {
        setMsg(j?.error || 'Failed to delete pick')
      } else {
        setMyPicks(cur => cur.filter(x => x.id !== p.id))
        setMsg('')
      }
    } catch (e: any) {
      setMsg(e?.message || 'Failed to delete pick')
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      {/* Page header — no secondary nav; top app nav handles it */}
      <section className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Picks</h1>

        <div className="ml-auto flex items-center gap-3">
          {/* League select (when multiple leagues exist) */}
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

          {/* Season */}
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

          {/* Week */}
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
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT: games */}
        <div className="grid gap-6 lg:col-span-8">
          <Card title={`Week ${week} — Games`}>
            {games.length === 0 ? (
              <div className="text-sm text-neutral-500">No games.</div>
            ) : (
              <div className="grid gap-4">
                {games.map((g) => {
                  const locked = gameLocked(g)
                  const pickedTeam = pickedTeamIdForGame(g.id)
                  const canClickEither = !locked && (pickedTeam ? true : picksLeft > 0)

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
                          {(g.status || (locked ? 'LIVE' : 'UPCOMING')).toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="flex-1">
                          <button
                            type="button"
                            disabled={!canClickEither}
                            onClick={() => canClickEither && addPick(g, g.home.id)}
                            className="w-full"
                            aria-label="Pick home team"
                          >
                            <TeamPill
                              teamId={g.home.id}
                              teamIndex={teamIndex}
                              size="sm"
                              mdUpSize="xl"
                              fluid
                              variant="subtle"
                              labelMode="abbrNick"
                              selected={pickedTeam === g.home.id}
                              disabled={!canClickEither}
                            />
                          </button>
                        </div>

                        <div className="text-neutral-400">—</div>

                        <div className="flex-1">
                          <button
                            type="button"
                            disabled={!canClickEither}
                            onClick={() => canClickEither && addPick(g, g.away.id)}
                            className="w-full"
                            aria-label="Pick away team"
                          >
                            <TeamPill
                              teamId={g.away.id}
                              teamIndex={teamIndex}
                              size="sm"
                              mdUpSize="xl"
                              fluid
                              variant="subtle"
                              labelMode="abbrNick"
                              selected={pickedTeam === g.away.id}
                              disabled={!canClickEither}
                            />
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT: my picks */}
        <aside className="grid gap-6 lg:col-span-4">
          <Card
            title={`My picks — Week ${week}`}
            right={<span className="text-xs opacity-70">{picksUsed} / {picksAllowed}</span>}
          >
            {myPicks.length === 0 ? (
              <div className="text-sm text-neutral-500">No picks yet.</div>
            ) : (
              <ul className="grid gap-2">
                {myPicks.map((p) => {
                  const g = p.game_id ? gameById.get(p.game_id) : undefined
                  const locked = gameLocked(g)
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
                      <button
                        className="rounded-md border px-2 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50 dark:hover:bg-neutral-900"
                        onClick={() => removePick(p)}
                        disabled={locked}
                        title={locked ? 'Locked' : 'Remove pick'}
                      >
                        Remove
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      {msg && <div className="mt-2 text-xs">{msg}</div>}
    </main>
  )
}
