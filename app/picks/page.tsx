k'use client'
import { useEffect, useMemo, useState } from 'react'
import TeamPill, { Team } from '@/components/TeamPill'

type League = { id: string; name: string; season: number }
type Game = {
  id: string; game_utc: string; week: number;
  home: { id: string }; away: { id: string };
  home_score?: number|null; away_score?: number|null; status?: string|null;
}
type Pick = { id: string; team_id: string; game_id: string|null }

function safeJson(res: Response) {
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : Promise.resolve(null)
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

  useEffect(() => {
    fetch('/api/my-leagues').then(r=>r.json()).then(j=>{
      const ls: League[] = j.leagues || []
      setLeagues(ls)
      if (!leagueId && ls[0]) { setLeagueId(ls[0].id); setSeason(ls[0].season) }
    })
    fetch('/api/team-map').then(r=>r.json()).then(j=> setTeams(j.teams || {}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!leagueId || !season || !week) return
    ;(async () => {
      setLoading(true)
      setLog('')
      try {
        const [g, p, u] = await Promise.all([
          fetch(`/api/games-for-week?season=${season}&week=${week}`).then(r=>r.json()),
          fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`).then(r=>r.json()),
          fetch(`/api/used-teams`).then(r=>r.json()),
        ])
        setGames((g.games ?? []).map((x:any)=>({
          id: x.id,
          game_utc: x.game_utc || x.start_time,
          week: x.week,
          home: { id: x.home?.id || x.home_team },
          away: { id: x.away?.id || x.away_team },
          home_score: x.home_score ?? null,
          away_score: x.away_score ?? null,
          status: x.status ?? 'UPCOMING'
        })))
        setPicks((p.picks ?? []).map((r:any)=>({ id:r.id, team_id:r.team_id, game_id:r.game_id })))
        setUsedTeamIds(new Set((u.used ?? []) as string[]))
      } catch (e:any) {
        setLog(e?.message || 'Load error')
      } finally { setLoading(false) }
    })()
  }, [leagueId, season, week])

  const picksLeft = Math.max(0, 2 - (picks?.length ?? 0))
  const pickedTeamIds = new Set(picks.map(x=>x.team_id))
  const pickByGame = useMemo(()=> {
    const m = new Map<string,string>()
    for (const p of picks) if (p.game_id) m.set(p.game_id, p.id)
    return m
  }, [picks])

  function isLocked(gameUtc: string) {
    return new Date(gameUtc) <= new Date()
  }

  async function togglePick(teamId: string, gameId: string) {
    setLog('')
    const existingPickId = pickByGame.get(gameId)
    try {
      if (existingPickId && picks.find(p => p.id === existingPickId)?.team_id === teamId) {
        // unpick same team in same game
        const del = await fetch(`/api/picks?id=${existingPickId}`, { method:'DELETE' })
        const j = await safeJson(del)
        if (!del.ok) throw new Error((j as any)?.error || 'Unpick failed')
      } else {
        if (existingPickId) {
          const del = await fetch(`/api/picks?id=${existingPickId}`, { method:'DELETE' })
          const j = await safeJson(del)
          if (!del.ok) throw new Error((j as any)?.error || 'Unpick failed')
        }
        const res = await fetch('/api/picks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ leagueId, season, week, teamId, gameId })
        })
        const j = await safeJson(res)
        if (!res.ok) throw new Error((j as any)?.error || 'Pick failed')
      }
      // refresh
      const j = await fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`).then(r=>r.json())
      setPicks((j.picks ?? []).map((r:any)=>({ id:r.id, team_id:r.team_id, game_id:r.game_id })))
      const u = await fetch(`/api/used-teams`).then(r=>r.json())
      setUsedTeamIds(new Set((u.used ?? []) as string[]))
    } catch (e:any) {
      setLog(e?.message || 'Error')
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Controls */}
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
        {loading && <div className="text-sm text-neutral-500">Loading…</div>}
        {!loading && games.length===0 && <div className="text-sm text-neutral-500">No games.</div>}

        {games.map(g => {
          const home = teams[g.home.id]; const away = teams[g.away.id]
          const locked = isLocked(g.game_utc)
          const gamePickId = pickByGame.get(g.id)
          const weeklyQuotaFull = picksLeft === 0 && !gamePickId
          const homeUsed = usedTeamIds.has(home?.id || '') && !pickedTeamIds.has(home?.id || '')
          const awayUsed = usedTeamIds.has(away?.id || '') && !pickedTeamIds.has(away?.id || '')

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
                    onClick={()=>home && togglePick(home.id, g.id)}
                  />
                </div>
                <div className="text-neutral-400">—</div>
                <div className="flex-1">
                  <TeamPill
                    team={away}
                    picked={pickedTeamIds.has(away?.id || '')}
                    disabled={locked || weeklyQuotaFull || awayUsed}
                    onClick={()=>away && togglePick(away.id, g.id)}
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

      {/* RIGHT 1/3 — weekly picks + season picks */}
      <aside className="grid gap-4">
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
                      {/* use img to avoid Next Image remote config */}
                      {t?.logo && <img src={(t.logo_dark || t.logo) as string} alt="" width={16} height={16} className="rounded" />}
                      {t ? `${t.abbreviation} — ${t.name}` : p.team_id}
                    </span>
                    <button
                      className="text-xs underline disabled:opacity-50"
                      disabled={locked}
                      onClick={()=>togglePick(p.team_id, p.game_id || '')}
                      title={locked ? 'Locked (kickoff passed)' : 'Unpick'}
                    >
                      {locked ? 'Locked' : 'Unpick'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {log && <p className="mt-3 text-xs text-red-600">{log}</p>}
        </section>

        {/* Season picks so far */}
        <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <h3 className="text-base font-semibold mb-3">Season picks so far</h3>
          {usedTeamIds.size === 0 ? (
            <div className="text-sm text-neutral-500">None yet.</div>
          ) : (
            <ul className="grid gap-2">
              {[...usedTeamIds].map(id => {
                const t = teams[id]
                return (
                  <li key={id} className="flex items-center gap-2 text-sm">
                    {t?.logo && <img src={(t.logo_dark || t.logo) as string} alt="" width={16} height={16} className="rounded" />}
                    <span>{t ? `${t.abbreviation} — ${t.name}` : id}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </aside>
    </main>
  )
}

