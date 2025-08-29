'use client'

import { useEffect, useState } from 'react'

type Game = {
  id:string; start_time?:string; game_utc?:string; status?:string; week?:number;
  home?: any; away?: any; home_score?: number|null; away_score?: number|null
}
type Team = {
  id:string; name:string; abbreviation:string;
  color_primary?:string|null; color_secondary?:string|null;
  color_tertiary?:string|null; color_quaternary?:string|null;
  logo?:string|null; logo_dark?:string|null;
}

function parseHex(hex?: string|null){ if(!hex) return null; const s=hex.replace('#',''); const v=s.length===3?s.split('').map(c=>c+c).join(''):s; if(![3,6].includes(s.length)&&s.length!==6) return null; return { r:parseInt(v.slice(0,2),16), g:parseInt(v.slice(2,4),16), b:parseInt(v.slice(4,6),16) } }
function tint(hex?:string|null, amt=0.90){ const c=parseHex(hex); if(!c) return '#f3f4f6'; const r=Math.round(c.r+(255-c.r)*amt), g=Math.round(c.g+(255-c.g)*amt), b=Math.round(c.b+(255-c.b)*amt); return `rgb(${r}, ${g}, ${b})` }

export default function ScoreboardPage() {
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number>(1)
  const [games, setGames] = useState<Game[]>([])
  const [teams, setTeams] = useState<Record<string, Team>>({})
  const [loading, setLoading] = useState(false)
  const [showControls, setShowControls] = useState(false)

  useEffect(()=>{
    fetch('/api/team-map').then(r=>r.json()).then(j=>setTeams(j.teams||{}))
    ;(async ()=>{
      const cw = await fetch('/api/current-week').then(r=>r.json())
      setSeason(cw.season || new Date().getFullYear())
      setWeek(cw.week || 1)
      setLoading(true)
      const g = await fetch(`/api/games-for-week?season=${cw.season}&week=${cw.week}`).then(r=>r.json())
      const rows = (g?.games||[]).map((x:any)=>({
        id:x.id, start_time:x.start_time||x.game_utc, status:x.status||'UPCOMING', week:x.week,
        home:x.home, away:x.away,
        home_score: x.home_score ?? x.home?.score ?? null, away_score: x.away_score ?? x.away?.score ?? null
      }))
      setGames(rows); setLoading(false)
    })()
  },[])

  async function reloadManual() {
    setLoading(true)
    const g = await fetch(`/api/games-for-week?season=${season}&week=${week}`).then(r=>r.json())
    const rows = (g?.games||[]).map((x:any)=>({
      id:x.id, start_time:x.start_time||x.game_utc, status:x.status||'UPCOMING', week:x.week,
      home:x.home, away:x.away,
      home_score: x.home_score ?? x.home?.score ?? null, away_score: x.away_score ?? x.away?.score ?? null
    }))
    setGames(rows); setLoading(false)
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">NFL Scoreboard</h1>
        <button onClick={()=>setShowControls(s=>!s)} className="h-9 rounded-md border border-neutral-300 dark:border-neutral-700 px-3 text-sm">
          {showControls ? 'Hide controls' : 'Change week'}
        </button>
      </div>

      {showControls && (
        <div className="flex items-center gap-2">
          <input className="h-9 w-24 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm" type="number" value={season} onChange={e=>setSeason(+e.target.value)} />
          <input className="h-9 w-16 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm" type="number" value={week} onChange={e=>setWeek(+e.target.value)} />
          <button className="h-9 rounded-md border border-neutral-300 dark:border-neutral-700 px-3 text-sm" onClick={reloadManual}>Load</button>
        </div>
      )}

      {loading && <div className="text-sm text-neutral-500">Loading…</div>}
      {!loading && games.length===0 && <div className="text-sm text-neutral-500">No games for that week.</div>}

      <div className="grid gap-4">
        {games.map(g=>{
          const home:Team|undefined = teams[g.home?.id]
          const away:Team|undefined = teams[g.away?.id]
          const homeLogo = home?.logo || home?.logo_dark
          const awayLogo = away?.logo || away?.logo_dark
          const homeBase = home?.color_primary || home?.color_secondary || home?.color_tertiary || home?.color_quaternary || '#e5e7eb'
          const awayBase = away?.color_primary || away?.color_secondary || away?.color_tertiary || away?.color_quaternary || '#e5e7eb'
          const final = (g.status||'').toUpperCase().includes('FINAL')
          return (
            <div key={g.id} className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
              <div className="mb-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>{g.start_time ? new Date(g.start_time).toLocaleString() : '—'}</span>
                <span className="uppercase tracking-wide">{g.status||'—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 rounded-full px-3 py-2 border" style={{background:tint(homeBase,0.92), borderColor: homeBase}}>
                  <div className="flex items-center gap-2">
                    {homeLogo && <img src={homeLogo} width={18} height={18} alt="" className="rounded" />}
                    <span className="font-semibold">{home?.abbreviation ? `${home.abbreviation} — ` : ''}{home?.name || g.home?.name || '—'}</span>
                  </div>
                </div>
                <div className="text-neutral-400">—</div>
                <div className="flex-1 rounded-full px-3 py-2 border" style={{background:tint(awayBase,0.92), borderColor: awayBase}}>
                  <div className="flex items-center gap-2">
                    {awayLogo && <img src={awayLogo} width={18} height={18} alt="" className="rounded" />}
                    <span className="font-semibold">{away?.abbreviation ? `${away.abbreviation} — ` : ''}{away?.name || g.away?.name || '—'}</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                {final && g.home_score!=null && g.away_score!=null ? <>Score: {g.home_score} — {g.away_score}</> : <>Score: — — —</>}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
