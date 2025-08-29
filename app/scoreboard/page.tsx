'use client'

import { useEffect, useState } from 'react'

type Team = { id:string; name:string; abbreviation:string; logo?:string|null; logo_dark?:string|null }
type Game = {
  id:string; week:number; status?:string; start_time?:string; game_utc?:string;
  home: Team; away: Team; home_score?:number|null; away_score?:number|null
}

export default function ScoreboardPage() {
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number>(1)
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(()=>{ load() }, []) // initial

  async function load() {
    setLoading(true)
    const g = await fetch(`/api/games-for-week?season=${season}&week=${week}`).then(r=>r.json())
    setGames(g?.games || [])
    setLoading(false)
  }

  return (
    <main className="grid gap-4">
      <h1 className="text-2xl font-bold">NFL Scoreboard</h1>

      <div className="flex items-center gap-2">
        <input className="h-9 w-24 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
               type="number" value={season} onChange={e=>setSeason(+e.target.value)} />
        <input className="h-9 w-16 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
               type="number" value={week} onChange={e=>setWeek(+e.target.value)} />
        <button onClick={load} className="h-9 rounded border border-neutral-300 dark:border-neutral-700 px-3 text-sm">
          Load
        </button>
      </div>

      {loading && <div className="text-sm text-neutral-500">Loading…</div>}

      <div className="grid gap-3">
        {games.map(g=>(
          <div key={g.id} className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="mb-1 text-xs text-neutral-500">{g.start_time ? new Date(g.start_time).toLocaleString() : '—'} · Wk {g.week}</div>
            <div className="flex items-center justify-between">
              <div className="flex-1 flex items-center gap-2">
                {g.home?.logo && <img src={g.home.logo} alt="" width={18} height={18} className="rounded" />}
                <span className="font-medium">{g.home?.abbreviation ?? '—'} — {g.home?.name ?? '—'}</span>
              </div>
              <span className="text-neutral-400 mx-2">vs</span>
              <div className="flex-1 flex items-center gap-2 justify-end">
                <span className="font-medium">{g.away?.abbreviation ?? '—'} — {g.away?.name ?? '—'}</span>
                {g.away?.logo && <img src={g.away.logo} alt="" width={18} height={18} className="rounded" />}
              </div>
            </div>
            <div className="mt-1 text-xs text-neutral-500">Status: {g.status ?? 'UPCOMING'} · Score: {g.home_score ?? '—'} — {g.away_score ?? '—'}</div>
          </div>
        ))}
        {games.length===0 && !loading && <div className="text-sm text-neutral-500">No games.</div>}
      </div>
    </main>
  )
}
