// app/picks/page.tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import TeamPill from '@/components/TeamPill'
import SpecialPicksCard from "@/components/SpecialPicksCard"
import WrinkleCard from '@/components/WrinkleCard'
import type { Team } from '@/types/domain'
import SpecialPicksCard from '@/components/SpecialPicksCard'

type League = { id: string; name: string; season: number }
type Game = {
  id: string; game_utc: string; week: number;
  home: { id: string }; away: { id: string };
  home_score?: number|null; away_score?: number|null; status?: string|null;
}
type Pick = { id: string; team_id: string; game_id: string|null }

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

  // wrinkles
  const [wrinkles, setWrinkles] = useState<any[]>([])
  const [myWrinklePicks, setMyWrinklePicks] = useState<Record<string, Pick|null>>({})

  useEffect(() => {
    // my leagues + default selection
    fetch('/api/my-leagues').then(r=>r.json()).then(j=>{
      const ls: League[] = j.leagues || []
      setLeagues(ls)
      if (!leagueId && ls[0]) { setLeagueId(ls[0].id); setSeason(ls[0].season) }
    })
    // team map for pills
    fetch('/api/team-map').then(r=>r.json()).then(j=> setTeams(j.teams || {}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // main load when league/season/week set
  useEffect(() => {
    if (!leagueId || !season || !week) return
    ;(async () => {
      setLoading(true)
      setLog('')
      try {
        const [g, p] = await Promise.all([
          fetch(`/api/games-for-week?season=${season}&week=${week}`, { cache: 'no-store' }).then(r=>r.json()),
          fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' }).then(r=>r.json()),
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
        setPicks((p.picks ?? []).map((r: any) => ({ id: r.id, team_id: r.team_id, game_id: r.game_id })))

        // used teams (season-wide), guard with params
        const uRes = await fetch(`/api/used-teams?leagueId=${leagueId}&season=${season}`, { cache: 'no-store' })
        const u = await uRes.json().catch(()=>({}))
        setUsedTeamIds(new Set((u.used ?? []) as string[]))

        // active wrinkles + my wrinkle picks
        const wRes = await fetch(`/api/wrinkles/active?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' })
        const wj = await wRes.json().catch(()=>({}))
        const ws = wj?.wrinkles ?? []
        setWrinkles(ws)

        const entries: [string, Pick|null][] = await Promise.all(ws.map(async (w: any) => {
          try {
            const r = await fetch(`/api/wrinkles/${w.id}/picks`, { cache: 'no-store' })
            const jj = await r.json().catch(()=>({}))
            const p = Array.isArray(jj?.picks) ? jj.picks[0] : (jj?.pick ?? null)
            return [w.id, p]
          } catch { return [w.id, null] }
        }))
        const map: Record<string, Pick|null> = {}
        for (const [k,v] of entries) map[k] = v
        setMyWrinklePicks(map)
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

  async function safeParseJson(res: Response) {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      try { return await res.json() } catch { /* ignore */ }
    }
    return null
  }

  async function refreshWrinklePicks() {
    if (wrinkles.length === 0) return
    const entries: [string, Pick|null][] = await Promise.all(wrinkles.map(async (w: any) => {
      try {
        const r = await fetch(`/api/wrinkles/${w.id}/picks`, { cache: 'no-store' })
        const jj = await r.json().catch(()=>({}))
        const p = Array.isArray(jj?.picks) ? jj.picks[0] : (jj?.pick ?? null)
        return [w.id, p]
      } catch { return [w.id, null] }
    }))
    const map: Record<string, Pick|null> = {}
    for (const [k,v] of entries) map[k] = v
    setMyWrinklePicks(map)
  }

  async function togglePick(teamId: string, gameId: string) {
    setLog('')
    const existingPickId = pickByGame.get(gameId)
    try {
      if (existingPickId && picks.find(p => p.id === existingPickId)?.team_id === teamId) {
        const del = await fetch(`/api/picks?id=${existingPickId}`, { method: 'DELETE', cache: 'no-store' })
        if (!del.ok) {
          const j = await safeParseJson(del)
          throw new Error((j && (j as any).error) || 'Unpick failed')
        }
      } else {
        if (existingPickId) {
          const del = await fetch(`/api/picks?id=${existingPickId}`, { method: 'DELETE', cache: 'no-store' })
          if (!del.ok) {
            const j = await safeParseJson(del)
            throw new Error((j && (j as any).error) || 'Unpick failed')
          }
        }
        const res = await fetch('/api/picks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ leagueId, season, week, teamId, gameId }),
          cache: 'no-store',
        })
        if (!res.ok) {
          const j = await safeParseJson(res)
          throw new Error((j && (j as any).error) || 'Pick failed')
        }
      }
      // refresh weekly picks + used teams + wrinkle picks
      const j = await fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' }).then(r=>r.json())
      setPicks((j.picks ?? []).map((r: any) => ({ id: r.id, team_id: r.team_id, game_id: r.game_id })))
      const uRes = await fetch(`/api/used-teams?leagueId=${leagueId}&season=${season}`, { cache: 'no-store' })
      if (uRes.ok) {
        const u = await uRes.json().catch(()=>({}))
        setUsedTeamIds(new Set((u.used ?? []) as string[]))
      }
      await refreshWrinklePicks()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      setLog(msg)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Controls row spans full width */}
      <div className="lg:col-span-3 flex flex-wrap items-end gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight mr-auto">Make Your Picks</h1>
        <label className="text-sm">League
          <select className="ml-2 h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                  value={leagueId} onChange={e=>setLeagueId(e.target.value)}>
            <option value="" disabled>Choose…</option>
            {leagues.map(l=> <option key={l.id} value={l.id}>{l.name} · {l.season}</option>)}
          </select>
        </label>
        <label className="text-sm">Season
          <input className="ml-2 h-9 w-24 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                 type="number" value={season} onChange={e=>setSeason(+e.target.value)} />
        </label>
        <label className="text-sm">Week
          <input className="ml-2 h-9 w-16 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                 type="number" value={week} onChange={e=>setWeek(+e.target.value)} />
        </label>
        <span className="ml-auto text-sm text-neutral-600 dark:text-neutral-400">
          Picks left this week: <b>{picksLeft}</b>
        </span>
      </div>

      {/* LEFT 2/3 — games */}
      <section className="lg:col-span-2 grid gap-4">
        {/* Special picks (wrinkles) */}
        {wrinkles.length > 0 && (
          <div className="grid gap-4">
            <h2 className="text-base font-semibold">Special Picks</h2>
            {wrinkles.map(w => (
              <WrinkleCard
                key={w.id}
                wrinkle={w}
                teams={teams}
                myPick={myWrinklePicks[w.id] ?? null}
                onChanged={refreshWrinklePicks}
              />
            ))}
          </div>
        )}

        {loading && <div className="text-sm text-neutral-500">Loading…</div>}
        {!loading && games.length===0 && <div className="text-sm text-neutral-500">No games.</div>}

        {games.map(g => {
          const home = teams[g.home.id]; const away = teams[g.away.id]
          const locked = isLocked(g.game_utc)
          const gamePickId = pickByGame.get(g.id)
          const weeklyQuotaFull = picksLeft === 0 && !gamePickId
          const homeUsed = (home?.id ? usedTeamIds.has(home.id) : false) && !pickedTeamIds.has(home?.id || '')
          const awayUsed = (away?.id ? usedTeamIds.has(away.id) : false) && !pickedTeamIds.has(away?.id || '')

          return (
            <article key={g.id} className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
              <div className="mb-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>{new Date(g.game_utc).toLocaleString()} • Week {g.week}</span>
                <span className="uppercase tracking-wide">
                  {locked ? 'LOCKED' : (g.status || 'UPCOMING')}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <TeamPill
                    team={home}
                    picked={pickedTeamIds.has(home?.id || '')}
                    disabled={locked || weeklyQuotaFull || homeUsed}
                    onClick={()=>togglePick(home!.id, g.id)}
                  />
                </div>
                <div className="text-neutral-400">—</div>
                <div className="flex-1">
                  <TeamPill
                    team={away}
                    picked={pickedTeamIds.has(away?.id || '')}
                    disabled={locked || weeklyQuotaFull || awayUsed}
                    onClick={()=>togglePick(away!.id, g.id)}
                  />
                </div>
              </div>

              <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                Score: {g.home_score!=null && g.away_score!=null ? `${g.home_score} — ${g.away_score}` : '— — —'}
              </div>
            </article>
          )
        })}
      </section>

      {/* RIGHT 1/3 — this week's picks */}
      <aside className="grid gap-4">
        <SpecialPicksCard leagueId={leagueId} season={season} week={week} teams={teams} isLocked={isLocked} />
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
                    <span className="font-medium flex items-center gap-2">
                      {t?.logo && <Image src={(t.logo_dark||t.logo)!} alt="" width={16} height={16} className="rounded" />}
                      {t ? `${t.abbreviation} — ${t.name}` : p.team_id}
                    </span>
                    <button
                      className="text-xs underline disabled:opacity-50"
                      disabled={locked}
                      onClick={()=> p.game_id ? togglePick(p.team_id, p.game_id) : null}
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

        {/* My special pick(s) */}
        {wrinkles.length > 0 && (
          <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <header className="mb-3">
              <h2 className="text-base font-semibold">My special picks</h2>
            </header>
            {Object.values(myWrinklePicks).filter(Boolean).length === 0 ? (
              <div className="text-sm text-neutral-500">No special picks yet.</div>
            ) : (
              <ul className="text-sm grid gap-2">
                {Object.entries(myWrinklePicks).map(([wid, p]) => {
                  if (!p) return null
                  const t = teams[p.team_id]
                  const gm = games.find(g=>g.id===p.game_id)
                  const locked = gm ? isLocked(gm.game_utc) : false
                  return (
                    <li key={p.id} className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2">
                      <span className="font-medium">{t ? `${t.abbreviation} — ${t.name}` : p.team_id}</span>
                      <button
                        type="button"
                        className="text-xs underline disabled:opacity-50"
                        disabled={locked}
                        onClick={async ()=> {
                          await fetch(`/api/wrinkles/${wid}/picks?id=${p.id}`, { method: 'DELETE', cache: 'no-store' })
                          await refreshWrinklePicks()
                        }}
                      >
                        {locked ? 'Locked' : 'Unpick'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}

        {log && <pre className="text-xs text-red-600 whitespace-pre-wrap">{log}</pre>}
      </aside>
    </main>
  )
}
