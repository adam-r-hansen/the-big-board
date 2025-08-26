'use client'
import { useState } from 'react'

export default function AdminPage() {
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number>(1)
  const [log, setLog] = useState<string>('')

  async function run(path: string) {
    const res = await fetch(`/api/${path}?season=${season}&week=${week}`, { method: 'POST' })
    const data = await res.json()
    setLog(prev => prev + `\n${path}: ` + JSON.stringify(data))
  }

  return (
    <main style={{display:'grid', gap:'1rem'}}>
      <h1 style={{fontSize:'1.5rem', fontWeight:600}}>Admin</h1>
      <div style={{display:'flex', gap:'.5rem'}}>
        <input style={{border:'1px solid #ccc', padding:'.25rem .5rem'}} type="number" value={season} onChange={e => setSeason(+e.target.value)} />
        <input style={{border:'1px solid #ccc', padding:'.25rem .5rem'}} type="number" value={week} onChange={e => setWeek(+e.target.value)} />
      </div>
      <div style={{display:'flex', gap:'.5rem', flexWrap:'wrap'}}>
        <button style={{border:'1px solid #ccc', padding:'.25rem .5rem'}} onClick={() => run('import-teams')}>Import Teams</button>
        <button style={{border:'1px solid #ccc', padding:'.25rem .5rem'}} onClick={() => run('import-week')}>Import Week Schedule</button>
        <button style={{border:'1px solid #ccc', padding:'.25rem .5rem'}} onClick={() => run('refresh-scores')}>Refresh Scores</button>
<button
  style={{border:'1px solid #ccc', padding:'.25rem .5rem'}}
  onClick={() => fetch('/api/enrich-team-colors', { method: 'POST' }).then(r => r.json()).then(j => setLog(prev => prev + `\nENRICH: ${JSON.stringify(j)}`))}
>
  Enrich Team Colors
</button>
<button
  style={{border:'1px solid #ccc', padding:'.25rem .5rem'}}
  onClick={()=>{
    const season = Number((document.querySelectorAll('input[type=number]')[0] as HTMLInputElement).value)
    const week   = Number((document.querySelectorAll('input[type=number]')[1] as HTMLInputElement).value)
    const leagueId = prompt('League ID to score?') || ''
    fetch(`/api/score-week?leagueId=${leagueId}&season=${season}&week=${week}`, { method: 'POST' })
      .then(r=>r.json())
      .then(j=>setLog(prev => prev + `\nSCORE-WEEK: ` + JSON.stringify(j)))
  }}
>
  Score Week
</button>
     
 </div>
      <pre style={{whiteSpace:'pre-wrap', border:'1px solid #eee', padding:'.5rem', fontSize:'.9rem', background:'#f9f9f9', color:'#111'}}>{log}</pre>
    </main>
  )
}
