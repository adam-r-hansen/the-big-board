// app/picks/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import TeamPill from '@/components/TeamPill'
import type { Team } from '@/types/domain'

type League = { id: string; name: string; season: number }
type Game = {
  id: string; game_utc: string; week: number;
  home: { id: string }; away: { id: string };
  home_score?: number|null; away_score?: number|null; status?: string|null;
}
type Pick = { id: string; team_id: string; game_id: string|null }

const noStore = (u:string) => u + (u.includes('?') ? '&' : '?') + '_=' + Date.now()

/** Log every API call, surface errors with exact JSON from server */
async function apiFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(noStore(url), { cache: 'no-store', ...init })
  let data: any = null
  try { data = await res.clone().json() } catch {/* empty or non-JSON */}
  if (!res.ok) {
    const msg = data?.error || data?.reason || `${res.status} ${res.statusText}`
    console.warn('API FAIL', { url, status: res.status, data })
    throw new Error(msg)
  }
  console.info('API OK', { url, status: res.status, data })
  return (data ?? {}) as T
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
  const [pending, setPending] = useState(false)
  const [log, setLog] = useState('')

  // load leagues + team map
  useEffect(() => {
    fetch('/api/my-leagues').then(r=>r.json()).then(j=>{
      const ls: League[] = j.leagues || []
      setLeagues(ls)
      if (!leagueId && ls[0]) { setLeagueId(ls[0].id); setSeason(ls[0].season) }
    })
    fetch('/api/team-map').then(r=>r.json()).then(j=> setTeams(j.teams || {}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // fetch for current controls
  useEffect(() => {
    if (!leagueId || !season || !week) return
    ;(async () => {
      setLoading(true)
      setLog('')
      try {
        const [g, p, u] = await Promise.all([
          apiFetch<{games:any[]}>(`/api/games-for-week?season=${season}&week=${week}`),
          apiFetch<{picks:any[]}>(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`),
          apiFetch<{used:string[]}>(`/api/used-teams?leagueId=${leagueId}&season=${season}&week=${week}`),
        ])
        setGames((g.games ?? []).map((x: any) => ({
          id: x.id,
          game_utc: x.game_utc || x.start_time,
          week: x.week,
          home: { id: x.home?.id || x.home_team },
          away: { id: x.away?.id || x.away_team },
          home_score: x.home_score ?? null,
          away_score: x.away_score ?? null,
          status: x.status ?? 'UPCOMING'
        })))
        setPicks((p.picks ?? []).map((r: any) => ({ id: r.id, team_id: r.team_id, game_id: (r.game_id ?? r.gameId ?? null) })))
        setUsedTeamIds(new Set((u.used ?? []) as string[]))
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Load error'
        setLog(msg)
      } finally {
        setLoading(false)
      }
    })()
  }, [leagueId, season, week])

  const picksLeft = Math.max(0, 2 - (picks?.length ?? 0))
  const pickedTeamIds = new Set(picks.map(x=>x.team_id))
  const pickByGame = useMemo(() => {
    const m = new Map<string, string>() // gameId -> pickId
    for (const p of picks) if (p.game_id) m.set(p.game_id, p.id)
    return m
  }, [picks])

  function isLocked(gameUtc: string) {
    return new Date(gameUtc) <= new Date()
  }

  async function refreshPicksAndUsed() {
    try {
      const p = await apiFetch<{picks:any[]}>(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`)
      setPicks((p.picks ?? []).map((r: any) => ({ id: r.id, team_id: r.team_id, game_id: (r.game_id ?? r.gameId ?? null) })))
      const u = await apiFetch<{used:string[]}>(`/api/used-teams?leagueId=${leagueId}&season=${season}&week=${week}`)
      setUsedTeamIds(new Set((u.used ?? []) as string[]))
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'Refresh failed')
    }
  }

  async function unpick(p: Pick) {
    setLog('')
    setPending(true)
    try {
      const qs = new URLSearchParams()
      if (p.id) qs.set('id', p.id)
      if (leagueId) qs.set('leagueId', leagueId)
      qs.set('season', String(season))
      qs.set('week', String(week))
      qs.set('teamId', p.team_id)
      if (p.game_id) qs.set('gameId', p.game_id)

      await apiFetch(`/api/picks?${qs.toString()}`, {
        method: 'DELETE',
        headers: { accept: 'application/json' },
      })
      await refreshPicksAndUsed()
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'Unpick failed')
    } finally {
      setPending(false)
    }
  }

  async function togglePick(teamId: string, gameId: string) {
    setLog('')
    setPending(true)
    try {
      const existingPickId = pickByGame.get(gameId)

      if (existingPickId && picks.find(p => p.id === existingPickId)?.team_id === teamId) {
        // same pick → unpick (no optimistic UI)
        await apiFetch(`/api/picks?id=${existingPickId}`, { method: 'DELETE' })
      } else {
        // swap within the same game first
        if (existingPickId) {
          await apiFetch(`/api/picks?id=${existingPickId}`, { method: 'DELETE' })
        }
        await apiFetch('/api/picks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ leagueId, season, week, teamId, gameId })
        })
      }
      await refreshPicksAndUsed()
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'Pick failed')
    } finally {
      setPending(false)
    }
  }

  // ***** derived data placed INSIDE the component, above return *****
  const usedTeamsArr = useMemo(
    () => Array.from(usedTeamIds).map(id => teams[id]).filter(Boolean) as Team[],
    [usedTeamIds, teams]
  )

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
      {/* Controls */}
      <div className="lg:col-span-3 flex flex-wrap items-end gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight mr-auto">Make Your Picks</h1>
        <label className="text-sm">League
          <select className="ml-2 h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                  value={leagueId} onChange={e=>setLeagueId(e.target.value)} disabled={pending}>
            <option value="" disabled>Choose…</option>
            {leagues.map(l=> <option key={l.id} value={l.id}>{l.name} · {l.season}</option>)}
          </select>
        </label>
        <label className="text-sm">Season
          <input className="ml-2 h-9 w-24 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                 type="number" value={season} onChange={e=>setSeason(+e.target.value)} disabled={pending}/>
        </label>
        <label className="text-sm">Week
          <input className="ml-2 h-9 w-16 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                 type="number" value={week} onChange={e=>setWeek(+e.target.value)} disabled={pending}/>
        </label>
        <span className="ml-auto text-sm text-neutral-600 dark:text-neutral-400">
          Picks left this week: <b>{picksLeft}</b>
        </span>
      </div>

      {/* Sidebar — top on mobile */}
      <aside className="order-first lg:order-none lg:col-span-1 lg:sticky top-4 max-w-[420px] grid gap-4">
        <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">My picks — Week {week}</h2>
          </header>
          {picks.length === 0 ? (
            <div className="text-sm text-neutral-500">No picks yet.</div>
          ) : (
            <ul className="text-sm grid gap-2">
              {picks.map(p => {
                const t = teams[p.team_id]
                const locked = p.game_id
                  ? isLocked(games.find(g=>g.id===p.game_id)?.game_utc || '')
                  : false
                return (
                  <li key={p.id} className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2">
                    <span className="font-medium">
                      {t ? `${t.abbreviation} — ${t.name}` : p.team_id}
                    </span>
                    <button
                      type="button"
                      className="text-xs underline disabled:opacity-50"
                      disabled={locked || pending}
                      onClick={()=> void unpick(p)}
                      title={locked ? 'Locked (kickoff passed)' : 'Unpick'}
                    >
                      {locked ? 'Locked' : 'Unpick'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Season so far (prior weeks only) */}
        <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <header className="mb-3"><h2 className="text-base font-semibold">Season so far</h2></header>
          {usedTeamsArr.length === 0 ? (
            <div className="text-sm text-neutral-500">No prior-week teams yet.</div>
          ) : (
            <ul className="grid gap-2">
              {usedTeamsArr.map((t) => (
                <li key={t.id} className="flex items-center">
                  <TeamPill team={t} picked disabled />
                </li>
              ))}
            </ul>
          )}
        </section>

        {log && <div className="text-xs text-red-600 whitespace-pre-wrap">{log}</div>}
      </aside>

      {/* Games */}
      <section className="lg:col-span-2 grid gap-4">
        {loading && <div className="text-sm text-neutral-500">Loading…</div>}
        {!loading && games.length===0 && <div className="text-sm text-neutral-500">No games.</div>}

        {games.map(g => {
          const home = teams[g.home.id]; const away = teams[g.away.id]
          const locked = isLocked(g.game_utc)
          const gamePickId = pickByGame.get(g.id)
          const weeklyQuotaFull = picksLeft === 0 && !gamePickId

          // “Used” = prior weeks only (visual; server enforces real rules)
          const homeUsed = home?.id ? usedTeamIds.has(home.id) && !pickedTeamIds.has(home.id) : false
          const awayUsed = away?.id ? usedTeamIds.has(away.id) && !pickedTeamIds.has(away.id) : false

          return (
            <article key={g.id} className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 lg:p-5">
              <div className="mb-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>{new Date(g.game_utc).toLocaleString()} • Week {g.week}</span>
                <span className="uppercase tracking-wide">
                  {locked ? 'LOCKED' : (g.status || 'UPCOMING')}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2">
                  <TeamPill
                    team={home}
                    picked={pickedTeamIds.has(home?.id || '')}
                    disabled={locked || weeklyQuotaFull || pending}
                    onClick={()=>togglePick(home!.id, g.id)}
                  />
                  {homeUsed && <span className="text-[10px] uppercase tracking-wider text-neutral-500">USED</span>}
                </div>
                <div className="text-neutral-400">—</div>
                <div className="flex-1 flex items-center gap-2">
                  <TeamPill
                    team={away}
                    picked={pickedTeamIds.has(away?.id || '')}
                    disabled={locked || weeklyQuotaFull || pending}
                    onClick={()=>togglePick(away!.id, g.id)}
                  />
                  {awayUsed && <span className="text-[10px] uppercase tracking-wider text-neutral-500">USED</span>}
                </div>
              </div>

              <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                Score: {g.home_score!=null && g.away_score!=null ? `${g.home_score} — ${g.away_score}` : '— — —'}
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}
