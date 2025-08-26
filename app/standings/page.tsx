'use client'
import { useEffect, useState } from 'react'

export default function StandingsPage() {
  const [leagueId, setLeagueId] = useState('LEAGUE_UUID')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [rows, setRows] = useState<any[]>([])
  const [log, setLog] = useState('')

  async function load() {
    const res = await fetch(`/api/standings?leagueId=${leagueId}&season=${season}`)
    const json = await res.json()
    setRows(json.standings || [])
    setLog(JSON.stringify(json))
  }

  useEffect(() => { /* noop */ }, [])

  return (
    <main style={{display:'grid', gap:12}}>
      <h1 style={{fontSize:'1.5rem', fontWeight:700}}>Standings</h1>
      <div style={{display:'flex', gap:8}}>
        <input style={{border:'1px solid #ccc', padding:'.25rem .5rem'}} value={leagueId} onChange={e=>setLeagueId(e.target.value)} />
        <input type="number" style={{border:'1px solid #ccc', padding:'.25rem .5rem'}} value={season} onChange={e=>setSeason(+e.target.value)} />
        <button style={{border:'1px solid #ccc', padding:'.25rem .5rem'}} onClick={load}>Load</button>
      </div>
      <table style={{borderCollapse:'collapse', width:'100%'}}>
        <thead>
          <tr><th style={{textAlign:'left', padding:8}}>Rank</th><th style={{textAlign:'left', padding:8}}>Player</th><th style={{textAlign:'right', padding:8}}>Points</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.profile_id} style={{borderTop:'1px solid #eee'}}>
              <td style={{padding:8}}>{i+1}</td>
              <td style={{padding:8}}>{r.profiles?.display_name || r.profiles?.email || r.profile_id}</td>
              <td style={{padding:8, textAlign:'right'}}>{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <pre style={{whiteSpace:'pre-wrap', fontSize:12, opacity:.7}}>{log}</pre>
    </main>
  )
}
