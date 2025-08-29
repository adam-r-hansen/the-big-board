'use client'
import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'

type League = { id: string; name: string; season: number }
type Team = {
  id: string; name: string; abbreviation: string;
  color_primary?: string|null; color_secondary?: string|null;
  color_tertiary?: string|null; color_quaternary?: string|null;
  color_pref_light?: 'primary'|'secondary'|'tertiary'|'quaternary'|null;
  color_pref_dark?:  'primary'|'secondary'|'tertiary'|'quaternary'|null;
  logo?: string|null; logo_dark?: string|null;
}
type Game = {
  id: string; game_utc: string; week: number; status?: string;
  home: Team; away: Team; home_score?: number|null; away_score?: number|null;
}
type PickRow = { team_id: string; game_id: string }

function parseHex(hex?: string|null) {
  if (!hex) return null
  const s = hex.replace('#','').trim()
  const v = s.length===3 ? s.split('').map(c=>c+c).join('') : s
  if (v.length!==6) return null
  const r=parseInt(v.slice(0,2),16), g=parseInt(v.slice(2,4),16), b=parseInt(v.slice(4,6),16)
  return { r,g,b }
}
function relL({r,g,b}:{r:number;g:number;b:number}) {
  const f=(c:number)=>{ c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4) }
  const R=f(r), G=f(g), B=f(b); return 0.2126*R+0.7152*G+0.0722*B
}
function contrast(bgHex:string, textHex:string) {
  const bg=parseHex(bgHex), tx=parseHex(textHex); if(!bg||!tx) return 0
  const L1=relL(bg)+0.05, L2=relL(tx)+0.05; return L1>L2 ? L1/L2 : L2/L1
}
function textOn(bg?:string|null) {
  const c = contrast(bg||'#e5e7eb', '#000')
  return c >= contrast(bg||'#e5e7eb', '#fff') ? '#000' : '#fff'
}
function tint(hex?:string|null, t=0.9) {
  const c = parseHex(hex); if(!c) return '#eceff1'
  const r=Math.round(c.r+(255-c.r)*t), g=Math.round(c.g+(255-c.g)*t), b=Math.round(c.b+(255-c.b)*t)
  return `rgb(${r} ${g} ${b})`
}
function colorByKey(t?:Team, k?:string|null) {
  if (!t) return null
  return k==='primary'?t.color_primary
    : k==='secondary'?t.color_secondary
    : k==='tertiary'?t.color_tertiary
    : k==='quaternary'?t.color_quaternary
    : null
}
function baseColor(t?:Team, dark=false) {
  const pref = dark ? t?.color_pref_dark : t?.color_pref_light
  return colorByKey(t, pref) || t?.color_primary || t?.color_secondary || t?.color_tertiary || t?.color_quaternary || '#eceff1'
}
function usePrefersDark() {
  const [dark, setDark] = useState(false)
  useEffect(()=>{
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const sync=()=>setDark(!!mq?.matches); sync()
    mq?.addEventListener?.('change', sync); return ()=>mq?.removeEventListener?.('change', sync)
  },[])
  return dark
}

function TeamPill({
  team, active, disabled, onClick,
}:{
  team: Team; active?: boolean; disabled?: boolean; onClick?: ()=>void
}) {
  const dark = usePrefersDark()
  const b = baseColor(team, dark)
  const bg = tint(b, 0.90)
  const fg = textOn(bg)
  const borderWidth = active ? 2 : 1
  const logo = dark ? (team.logo_dark || team.logo) : (team.logo || team.logo_dark)

  return (
    <button
      onClick={disabled?undefined:onClick}
      aria-pressed={!!active}
      disabled={disabled}
      className="min-h-12 w-full rounded-full border px-3 py-2 text-left transition-[border-width,opacity] disabled:opacity-60"
      style={{ background:bg, color:fg, borderColor:b, borderWidth }}
      title={`${team.abbreviation} — ${team.name}`}
    >
      <span className="inline-flex items-center gap-2 font-semibold">
        {logo && <Image src={logo} alt="" width={18} height={18} className="rounded" />}
        <span>{team.abbreviation} — {team.name}</span>
      </span>
    </button>
  )
}

export default function PicksPage() {
  const dark = usePrefersDark()
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number>(1)
  const [games, setGames] = useState<Game[]>([])
  const [myPicks, setMyPicks] = useState<PickRow[]>([])
  const [usedTeamIds, setUsedTeamIds] = useState<Set<string>>(new Set())
  const [log, setLog] = useState('')

  const pickedIds = useMemo(()=> new Set(myPicks.map(p=>p.team_id)), [myPicks])
  const picksLeft = Math.max(0, 2 - myPicks.length)
  const isLocked = (utc: string) => new Date(utc).getTime() <= Date.now()

  useEffect(()=>{
    fetch('/api/my-leagues').then(r=>r.json()).then(j=>{
      const ls: League[] = j.leagues || []
      setLeagues(ls)
      if (!leagueId && ls[0]) { setLeagueId(ls[0].id); setSeason(ls[0].season) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  useEffect(()=>{
    if (!leagueId || !season || !week) return
    setLog('')
    ;(async ()=>{
      const [g,p,used] = await Promise.all([
        fetch(`/api/games-for-week?season=${season}&week=${week}`).then(r=>r.json()),
        fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`).then(r=>r.json()),
        fetch(`/api/used-teams?leagueId=${leagueId}&season=${season}`).then(r=>r.json()),
      ])
      setGames((g.games||[]).map((x:any)=>({
        id:x.id, game_utc:x.game_utc||x.start_time, week:x.week, status:x.status,
        home:x.home, away:x.away,
        home_score:x.home_score ?? x.home?.score ?? null,
        away_score:x.away_score ?? x.away?.score ?? null,
      })))
      setMyPicks(p.picks || [])
      setUsedTeamIds(new Set(used.teams || []))
    })()
  }, [leagueId, season, week])

  async function togglePick(team: Team, game: Game) {
    setLog('')
    const alreadyPickedThisGame = myPicks.find(x=>x.game_id===game.id)
    const pickingSame = alreadyPickedThisGame && alreadyPickedThisGame.team_id===team.id
    const locked = isLocked(game.game_utc)

    if (locked) { setLog('Game locked.'); return }

    if (pickingSame) {
      // UNPICK
      const res = await fetch('/api/picks', { method:'DELETE', headers:{'content-type':'application/json'},
        body: JSON.stringify({ leagueId, season, week, gameId: game.id, teamId: team.id }) })
      const j = await res.json()
      if (!res.ok) { setLog(j.error||'Error'); return }
    } else {
      if (picksLeft===0 && !alreadyPickedThisGame) { setLog('You already have 2 picks this week.'); return }
      if (usedTeamIds.has(team.id)) { setLog('You already used this team this season.'); return }
      const res = await fetch('/api/picks', { method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ leagueId, season, week, teamId: team.id, gameId: game.id }) })
      const j = await res.json()
      if (!res.ok) { setLog(j.error||'Error'); return }
    }

    // refresh both week picks + used set
    const [p, used] = await Promise.all([
      fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`).then(r=>r.json()),
      fetch(`/api/used-teams?leagueId=${leagueId}&season=${season}`).then(r=>r.json())
    ])
    setMyPicks(p.picks||[])
    setUsedTeamIds(new Set(used.teams||[]))
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 space-y-4">
      <h1 className="text-3xl font-extrabold tracking-tight">Make Your Picks</h1>

      <section className="flex flex-wrap items-center gap-2">
        <label className="text-sm">League
          <select className="ml-2 h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
            value={leagueId} onChange={e=>setLeagueId(e.target.value)}>
            <option value="" disabled>Choose…</option>
            {leagues.map(l=> <option key={l.id} value={l.id}>{l.name} · {l.season}</option>)}
          </select>
        </label>
        <label className="text-sm">Season
          <input type="number" className="ml-2 h-9 w-24 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
            value={season} onChange={e=>setSeason(+e.target.value)} />
        </label>
        <label className="text-sm">Week
          <input type="number" className="ml-2 h-9 w-16 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
            value={week} onChange={e=>setWeek(+e.target.value)} />
        </label>
        <span className="ml-auto text-sm text-neutral-600 dark:text-neutral-400">Picks left this week: <b>{Math.max(0,2-myPicks.length)}</b></span>
      </section>

      <section className="space-y-4">
        {games.map(g=>{
          const locked = isLocked(g.game_utc)
          const leftActive  = !!myPicks.find(p=>p.game_id===g.id && p.team_id===g.home.id)
          const rightActive = !!myPicks.find(p=>p.game_id===g.id && p.team_id===g.away.id)
          const leftDisabled  = locked || rightActive || usedTeamIds.has(g.home.id)
          const rightDisabled = locked || leftActive  || usedTeamIds.has(g.away.id)

          return (
            <div key={g.id} className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>{new Date(g.game_utc).toLocaleString()} • Week {g.week}</span>
                <span className="uppercase tracking-wide">{locked ? 'LOCKED' : (g.status||'UPCOMING')}</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <TeamPill team={g.home} active={leftActive} disabled={leftDisabled} onClick={()=>togglePick(g.home, g)} />
                <div className="hidden sm:block text-neutral-400 text-center">—</div>
                <TeamPill team={g.away} active={rightActive} disabled={rightDisabled} onClick={()=>togglePick(g.away, g)} />
              </div>

              <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                {locked && <span className="mr-3">🔒 Locked</span>}
                {usedTeamIds.has(g.home.id) && <span className="mr-3">🏷️ {g.home.abbreviation} used</span>}
                {usedTeamIds.has(g.away.id) && <span className="mr-3">🏷️ {g.away.abbreviation} used</span>}
              </div>
            </div>
          )
        })}
      </section>

      <pre className="text-xs opacity-70 whitespace-pre-wrap">{log}</pre>
    </main>
  )
}

