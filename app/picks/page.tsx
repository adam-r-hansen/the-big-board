'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type League = { id: string; name: string; season: number }
type Team = {
  id: string; name: string; abbreviation: string;
  primary_color?: string|null; secondary_color?: string|null;
  tertiary_color?: string|null; quaternary_color?: string|null;
  logo?: string|null; logo_dark?: string|null;
}
type Game = {
  id: string; game_utc: string; week: number;
  home: Team; away: Team;
  home_score?: number|null; away_score?: number|null;
}

/* ---------- color helpers ---------- */
function parseHex(hex?: string|null) {
  if (!hex) return null
  const s = hex.trim().replace('#','')
  if (![3,6,8].includes(s.length)) return null
  const v = s.length===3 ? s.split('').map(c=>c+c).join('') : s
  const r = parseInt(v.slice(0,2),16), g = parseInt(v.slice(2,4),16), b = parseInt(v.slice(4,6),16)
  return { r, g, b }
}
function relLuminance({r,g,b}:{r:number,g:number,b:number}) {
  const f = (c:number)=>{ c/=255; return c<=0.03928? c/12.92 : Math.pow((c+0.055)/1.055, 2.4) }
  const R=f(r), G=f(g), B=f(b); return 0.2126*R + 0.7152*G + 0.0722*B
}
function contrast(bgHex:string, textHex:string) {
  const bg=parseHex(bgHex), tx=parseHex(textHex); if(!bg||!tx) return 0
  const L1=relLuminance(bg)+0.05, L2=relLuminance(tx)+0.05
  return L1>L2 ? L1/L2 : L2/L1
}
function bestTextColor(bgHex?: string|null) {
  const bg = bgHex || '#e5e7eb'
  return contrast(bg, '#ffffff') >= contrast(bg, '#000000') ? '#ffffff' : '#000000'
}
/** add hex alpha to #RRGGBB — e.g. addAlpha('#003366','33') => '#00336633' */
function addAlpha(hex: string, alphaHex: string) {
  const clean = hex.replace('#','')
  const v = clean.length===3 ? clean.split('').map(c=>c+c).join('') : clean.slice(0,6)
  return `#${v}${alphaHex}`
}

function usePrefersDark() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const sync = () => setDark(!!mq?.matches)
    sync()
    mq?.addEventListener?.('change', sync)
    return () => mq?.removeEventListener?.('change', sync)
  }, [])
  return dark
}

/* ---------- UI: Team pill ---------- */
function Pill({ team, disabled=false, active=false, onClick }:{
  team:Team, disabled?:boolean, active?:boolean, onClick?:()=>void
}) {
  // fallback order: primary → secondary → tertiary → quaternary
  const solid =
    team.primary_color ||
    team.secondary_color ||
    team.tertiary_color ||
    team.quaternary_color ||
    '#e5e7eb'

  // light tint for background (≈20% alpha). If disabled, use a neutral tint.
  const bgTint = disabled ? '#e5e7eb' : addAlpha(solid, '33')
  const text = disabled ? '#6b7280' : bestTextColor(bgTint)

  return (
    <button
      onClick={disabled?undefined:onClick}
      aria-pressed={active}
      disabled={disabled}
      style={{
        height: 56,               // ≥44x44 target (WCAG)
        padding: '10px 14px',
        borderRadius: 999,
        border: active ? `2px solid ${solid}` : '1px solid rgba(0,0,0,0.15)',
        background: bgTint,
        color: text,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 700, letterSpacing: .2,
        display:'inline-flex', alignItems:'center', gap:10,
        minWidth: 300,            // uniform width for consistency
        boxShadow: active ? `0 0 0 3px ${addAlpha(solid, '22')}` : 'inset 0 0 0 1px rgba(0,0,0,0.06)'
      }}
      title={`${team.abbreviation} — ${team.name}`}
    >
      {team.logo && <img src={team.logo as string} alt="" width={20} height={20} style={{borderRadius:4}} />}
      <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
        {team.abbreviation} — {team.name}
      </span>
    </button>
  )
}

/* ---------- Page ---------- */
export default function PicksPage() {
  const sb = useMemo(()=>createClient(),[])
  const prefersDark = usePrefersDark()

  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number>(1)
  const [games, setGames] = useState<Game[]>([])
  const [myPicks, setMyPicks] = useState<{team_id:string, game_id:string}[]>([])
  const [log, setLog] = useState('')

  useEffect(()=>{ // load leagues
    fetch('/api/my-leagues').then(r=>r.json()).then(j=>{
      setLeagues(j.leagues || [])
      if (!leagueId && j.leagues?.[0]) setLeagueId(j.leagues[0].id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  function isLocked(gameUtc:string) {
    return new Date(gameUtc) <= new Date()
  }

  async function loadWeek() {
    setLog('')
    const g = await fetch(`/api/games-for-week?season=${season}&week=${week}`).then(r=>r.json())
    if (g.error) { setLog(g.error); setGames([]); return }
    const withLogos = (g.games || []).map((gm:Game) => {
      const swap = (t:Team):Team => {
        const img = prefersDark ? (t.logo_dark || t.logo) : (t.logo || t.logo_dark)
        return { ...t, logo: img }
      }
      return { ...gm, home: swap(gm.home), away: swap(gm.away) }
    })
    setGames(withLogos)

    if (leagueId) {
      const p = await fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`).then(r=>r.json())
      setMyPicks(p.picks || [])
    }
  }

  async function makePick(teamId:string, gameId:string) {
    setLog('')
    if (!leagueId) { setLog('Pick a league first'); return }
    if ((myPicks?.length ?? 0) >= 2) { setLog('You already have 2 picks this week.'); return }

    const res = await fetch('/api/picks', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ leagueId, season, week, teamId, gameId })
    })
    const j = await res.json()
    if (!res.ok) { setLog(j.error || 'Error'); return }
    const p = await fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`).then(r=>r.json())
    setMyPicks(p.picks || [])
    setLog(`Picked! ${JSON.stringify(j)}`)
  }

  const picksLeft = Math.max(0, 2 - (myPicks?.length ?? 0))
  const pickedTeamIds = new Set(myPicks.map(p=>p.team_id))

  return (
    <main style={{display:'grid', gap:16, padding:'16px 20px', maxWidth:1000, margin:'0 auto'}}>
      <h1 style={{fontSize:'1.75rem', fontWeight:800}}>Make Your Picks</h1>

      <section style={{display:'flex', flexWrap:'wrap', gap:8, alignItems:'center'}}>
        <label>League&nbsp;
          <select value={leagueId} onChange={e=>setLeagueId(e.target.value)} style={{border:'1px solid #ccc', padding:'6px 8px', minHeight:40}}>
            <option value="" disabled>Choose…</option>
            {leagues.map(l=> <option key={l.id} value={l.id}>{l.name} · {l.season}</option>)}
          </select>
        </label>
        <label>Season&nbsp;
          <input type="number" value={season} onChange={e=>setSeason(+e.target.value)} style={{border:'1px solid #ccc', padding:'6px 8px', width:100, minHeight:40}}/>
        </label>
        <label>Week&nbsp;
          <input type="number" value={week} onChange={e=>setWeek(+e.target.value)} style={{border:'1px solid #ccc', padding:'6px 8px', width:80, minHeight:40}}/>
        </label>
        <button onClick={loadWeek} style={{border:'1px solid #ccc', padding:'8px 12px', minHeight:40}}>Load</button>
        <span style={{marginLeft:'auto', opacity:.75}}>Picks left this week: <b>{picksLeft}</b></span>
      </section>

      <section style={{display:'grid', gap:12}}>
        {games.length===0 && <div style={{opacity:.7}}>No games loaded yet. Click "Load".</div>}
        {games.map(g=>{
          const locked = isLocked(g.game_utc)
          const leftActive = pickedTeamIds.has(g.home.id)
          const rightActive = pickedTeamIds.has(g.away.id)

          return (
            <div key={g.id} style={{
              border:'1px solid #e5e7eb',
              borderRadius:16, padding:14, display:'grid', gap:10,
              background: 'var(--card-bg, #ffffff)'
            }}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, color:'#6b7280', fontSize:12}}>
                <div style={{fontWeight:700, color:'inherit'}}>
                  {new Date(g.game_utc).toLocaleString()} • Week {g.week}
                </div>
                <div style={{textTransform:'uppercase', letterSpacing:.5}}>{locked ? 'Locked' : 'Upcoming'}</div>
              </div>
              <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
                <Pill team={g.home} disabled={locked || rightActive || picksLeft===0} active={leftActive} onClick={()=>makePick(g.home.id, g.id)} />
                <Pill team={g.away} disabled={locked || leftActive || picksLeft===0} active={rightActive} onClick={()=>makePick(g.away.id, g.id)} />
              </div>
            </div>
          )
        })}
      </section>

      <pre style={{whiteSpace:'pre-wrap', fontSize:12, opacity:.7}}>{log}</pre>
      <footer style={{fontSize:12, opacity:.6}}>
        Targets ≥44×44 CSS px (we use 56px). Dark mode via <code>dark</code> class with Tailwind. 
      </footer>
    </main>
  )
}
