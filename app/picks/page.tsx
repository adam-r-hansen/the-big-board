// app/picks/page.tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import SpecialPicksCard from '@/components/SpecialPicksCard'

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
  abbreviation?: string
  name?: string
  color_primary?: string
  color_secondary?: string
  logo?: string
  logo_dark?: string
}
type Game = {
  id: string
  season: number
  week: number
  game_utc: string
  status?: string
  home: { id: string }
  away: { id: string }
}
type Pick = { id: string; team_id: string; game_id: string | null }

function TeamButton({
  team,
  disabled,
  picked,
  onClick,
}: {
  team?: TeamLike
  disabled?: boolean
  picked?: boolean
  onClick?: () => void
}) {
  const abbr = team?.abbreviation ?? '—'
  const primary = team?.color_primary ?? '#999999'
  const secondary = team?.color_secondary ?? '#444444'
  return (
    <button
      type="button"
      disabled={!!disabled}
      onClick={disabled ? undefined : onClick}
      className={[
        'w-full h-14 rounded-xl border px-4 font-semibold tracking-wide',
        'transition-[transform,opacity] active:scale-[0.98]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90',
      ].join(' ')}
      style={{
        borderColor: primary,
        color: primary,
        boxShadow: picked ? `inset 0 0 0 2px ${primary}` : undefined,
        background: picked ? `linear-gradient(0deg, ${secondary}22, ${secondary}10)` : 'transparent',
      }}
    >
      {abbr}
    </button>
  )
}

function SectionCard({ children, title, right }: { children: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </header>
      {children}
    </section>
  )
}

export default function PicksPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number>(1)

  const [games, setGames] = useState<Game[]>([])
  const [picks, setPicks] = useState<Pick[]>([])
  const [teams, setTeams] = useState<Record<string, Team>>({})
  const [usedTeamIds, setUsedTeamIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState('')

  // wrinkle state (for right column lists)
  const [wrinkles, setWrinkles] = useState<any[]>([])
  const [myWrinklePicks, setMyWrinklePicks] = useState<Record<string, Pick | null>>({})

  // load leagues + teams once
  useEffect(() => {
    fetch('/api/my-leagues')
      .then((r) => r.json())
      .then((j) => {
        const ls: League[] = j.leagues || []
        setLeagues(ls)
        if (!leagueId && ls[0]) {
          setLeagueId(ls[0].id)
          setSeason(ls[0].season)
        }
      })
    fetch('/api/team-map')
      .then((r) => r.json())
      .then((j) => setTeams(j.teams || {}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // load week data when selection changes
  useEffect(() => {
    if (!leagueId || !season || !week) return
    ;(async () => {
      setLoading(true)
      setLog('')
      try {
        const [g, p] = await Promise.all([
          fetch(`/api/games-for-week?season=${season}&week=${week}`, { cache: 'no-store' }).then((r) => r.json()),
          fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' }).then((r) =>
            r.json(),
          ),
        ])

        setGames(
          (g.games ?? []).map((x: any) => ({
            id: x.id,
            game_utc: x.game_utc || x.start_time,
            status: x.status ?? 'UPCOMING',
            season: x.season,
            week: x.week,
            home: { id: x.home?.id ?? x.home_team ?? x.homeTeamId ?? x.home_team_id },
            away: { id: x.away?.id ?? x.away_team ?? x.awayTeamId ?? x.away_team_id },
          })),
        )
        setPicks((p.picks ?? []).map((r: any) => ({ id: r.id, team_id: r.team_id, game_id: r.game_id })))

        // season used teams (for disable hints)
        const uRes = await fetch(`/api/used-teams?leagueId=${leagueId}&season=${season}`, { cache: 'no-store' })
        if (uRes.ok) {
          const u = await uRes.json().catch(() => ({}))
          setUsedTeamIds(new Set((u.used ?? []) as string[]))
        }

        // wrinkle + my wrinkle picks (for right pane)
        const wRes = await fetch(
          `/api/wrinkles/active?leagueId=${leagueId}&season=${season}&week=${week}`,
          { cache: 'no-store' },
        )
        const wj = await wRes.json().catch(() => ({}))
        const ws = wj?.wrinkles ?? []
        setWrinkles(ws)

        const entries: [string, Pick | null][] = await Promise.all(
          ws.map(async (w: any) => {
            try {
              const r = await fetch(`/api/wrinkles/${w.id}/picks`, { cache: 'no-store' })
              const jj = await r.json().catch(() => ({}))
              const p = Array.isArray(jj?.picks) ? jj.picks[0] : jj?.pick ?? null
              return [w.id, p]
            } catch {
              return [w.id, null]
            }
          }),
        )
        const map: Record<string, Pick | null> = {}
        for (const [k, v] of entries) map[k] = v
        setMyWrinklePicks(map)
      } catch (e: any) {
        setLog(e?.message || 'Load error')
      } finally {
        setLoading(false)
      }
    })()
  }, [leagueId, season, week])

  const picksLeft = Math.max(0, 2 - (picks?.length ?? 0))
  const pickedTeamIds = new Set(picks.map((x) => x.team_id))
  const pickByGame = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of picks) if (p.game_id) m.set(p.game_id, p.id)
    return m
  }, [picks])

  const isLocked = (utc: string) => new Date(utc) <= new Date()

  async function safeParseJson(res: Response) {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      try {
        return await res.json()
      } catch {
        return null
      }
    }
    return null
  }

  async function togglePick(teamId: string, gameId: string) {
    try {
      const existingPickId = pickByGame.get(gameId)
      if (existingPickId) {
        const del = await fetch(`/api/picks?id=${existingPickId}`, { method: 'DELETE', cache: 'no-store' })
        if (!del.ok) throw new Error((await safeParseJson(del))?.error || 'Unpick failed')
      }
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leagueId, season, week, teamId, gameId }),
        cache: 'no-store',
      })
      if (!res.ok) throw new Error((await safeParseJson(res))?.error || 'Pick failed')

      // refresh my picks + used teams
      const j = await fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' })
        .then((r) => r.json())
      setPicks((j.picks ?? []).map((r: any) => ({ id: r.id, team_id: r.team_id, game_id: r.game_id })))

      const uRes = await fetch(`/api/used-teams?leagueId=${leagueId}&season=${season}`, { cache: 'no-store' })
      if (uRes.ok) {
        const u = await uRes.json().catch(() => ({}))
        setUsedTeamIds(new Set((u.used ?? []) as string[]))
      }
      await refreshWrinklePicks()
    } catch (e: any) {
      setLog(e?.message || 'Error')
    }
  }

  async function refreshWrinklePicks() {
    try {
      if (wrinkles.length === 0) return
      const entries: [string, Pick | null][] = await Promise.all(
        wrinkles.map(async (w: any) => {
          try {
            const r = await fetch(`/api/wrinkles/${w.id}/picks`, { cache: 'no-store' })
            const jj = await r.json().catch(() => ({}))
            return [w.id, (Array.isArray(jj?.picks) ? jj.picks[0] : jj?.pick ?? null) as any]
          } catch {
            return [w.id, null]
          }
        }),
      )
      const map: Record<string, Pick | null> = {}
      for (const [k, v] of entries) map[k] = v
      setMyWrinklePicks(map)
    } catch (e: any) {
      console.warn('refreshWrinklePicks failed', e?.message || e)
    }
  }

  // coerce Team -> TeamLike to satisfy components that expect undefined over null
  const teamsLike: Record<string, TeamLike> = useMemo(() => {
    const out: Record<string, TeamLike> = {}
    for (const [k, t] of Object.entries(teams)) {
      out[k] = {
        id: t.id,
        abbreviation: t.abbreviation ?? undefined,
        name: t.name ?? undefined,
        color_primary: t.color_primary ?? undefined,
        color_secondary: t.color_secondary ?? undefined,
        logo: t.logo ?? undefined,
        logo_dark: t.logo_dark ?? undefined,
      }
    }
    return out
  }, [teams])

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* top controls */}
      <section className="lg:col-span-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Image alt="" src="/favicon.ico" width={24} height={24} className="rounded" />
          <h1 className="text-xl font-bold">Make your picks</h1>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <select className="border rounded px-2 py-1 bg-transparent" value={leagueId} onChange={(e) => setLeagueId(e.target.value)}>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <select className="border rounded px-2 py-1 bg-transparent" value={season} onChange={(e) => setSeason(Number(e.target.value))}>
            {Array.from({ length: 3 }).map((_, i) => {
              const yr = new Date().getFullYear() - 1 + i
              return <option key={yr} value={yr}>{yr}</option>
            })}
          </select>
          <select className="border rounded px-2 py-1 bg-transparent" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
            {Array.from({ length: 18 }).map((_, i) => {
              const wk = i + 1
              return <option key={wk} value={wk}>Week {wk}</option>
            })}
          </select>
        </div>
      </section>

      {/* LEFT — wrinkle card */}
      <aside className="order-2 lg:order-1">
        <SpecialPicksCard leagueId={leagueId} season={season} week={week} teams={teamsLike} />
      </aside>

      {/* CENTER — schedule with pick buttons */}
      <section className="order-1 lg:order-2 grid gap-4">
        <SectionCard
          title={`Week ${week} — ${picksLeft} of 2 picks left`}
          right={<span className="text-xs text-neutral-500">{log}</span>}
        >
          {loading && <div className="text-sm text-neutral-500">Loading…</div>}
          {!loading && games.length === 0 && <div className="text-sm text-neutral-500">No games.</div>}

          {games.map((g, idx) => {
            const home = teamsLike[g.home.id]
            const away = teamsLike[g.away.id]
            const locked = isLocked(g.game_utc)
            const gamePickId = pickByGame.get(g.id)

            // Defensive: only block when user truly has 2 weekly picks and hasn't picked this game.
            const weeklyQuotaFull = (picks?.length ?? 0) >= 2 && !gamePickId

            // Season-used hint (still block; server re-validates anyway)
            const homeUsed = !!(home?.id && usedTeamIds.has(home.id) && !pickedTeamIds.has(home.id))
            const awayUsed = !!(away?.id && usedTeamIds.has(away.id) && !pickedTeamIds.has(away.id))

            // Helpful debug for the “top game not pickable” issue
            if (idx === 0) {
              console.debug('Top game flags', {
                gameId: g.id,
                locked,
                picksLen: picks?.length ?? 0,
                weeklyQuotaFull,
                homeUsed,
                awayUsed,
                picksLeft,
                gamePickId,
              })
            }

            return (
              <article key={g.id} className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
                <div className="mb-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                  <span>{new Date(g.game_utc).toLocaleString()} • Week {g.week}</span>
                  <span className="uppercase tracking-wide">{locked ? 'LOCKED' : g.status || 'UPCOMING'}</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <TeamButton
                      team={home}
                      picked={pickedTeamIds.has(home?.id || '')}
                      disabled={locked || weeklyQuotaFull || homeUsed}
                      onClick={() => togglePick(home!.id!, g.id)}
                    />
                  </div>
                  <div className="text-neutral-400">—</div>
                  <div className="flex-1">
                    <TeamButton
                      team={away}
                      picked={pickedTeamIds.has(away?.id || '')}
                      disabled={locked || weeklyQuotaFull || awayUsed}
                      onClick={() => togglePick(away!.id!, g.id)}
                    />
                  </div>
                </div>
              </article>
            )
          })}
        </SectionCard>
      </section>

      {/* RIGHT — my picks */}
      <aside className="order-3 grid gap-4">
        <SectionCard title={`My picks — Week ${week}`}>
          {picks.length === 0 ? (
            <div className="text-sm text-neutral-500">No picks yet.</div>
          ) : (
            <ul className="text-sm grid gap-2">
              {picks.map((p) => {
                const t = teamsLike[p.team_id]
                const locked = p.game_id ? isLocked(games.find((g) => g.id === p.game_id)?.game_utc || '') : false
                return (
                  <li key={p.id} className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2">
                    <span className="font-medium flex items-center gap-2">
                      {t?.abbreviation ?? p.team_id} — {t?.name ?? ''}
                    </span>
                    <button
                      className="text-xs underline disabled:opacity-50"
                      disabled={locked}
                      onClick={() => (p.game_id ? togglePick(p.team_id, p.game_id) : null)}
                      title={locked ? 'Locked (kickoff passed)' : 'Unpick'}
                    >
                      {locked ? 'Locked' : 'Unpick'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>

        {/* (Optional) mirror wrinkle pick in right rail */}
        {wrinkles.map((w) => {
          const pick = myWrinklePicks[w.id]
          const t = pick?.team_id ? teamsLike[pick.team_id] : undefined
          return (
            <SectionCard key={w.id} title={`Wrinkle — ${w.name}`}>
              {!pick ? (
                <div className="text-sm text-neutral-500">No wrinkle pick yet.</div>
              ) : (
                <div className="text-sm">
                  <div className="font-medium">{t?.abbreviation ?? pick.team_id} — {t?.name ?? ''}</div>
                </div>
              )}
            </SectionCard>
          )
        })}
      </aside>
    </main>
  )
}

