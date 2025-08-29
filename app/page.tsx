'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'

type League = { id: string; name: string; season: number }
type StandingRow = { profile_id: string; points: number; profiles?: { display_name?: string; email?: string } }
type Game = {
  id:string; start_time?: string; game_utc?: string; status?: string; week?: number;
  home?: any; away?: any; home_score?: number|null; away_score?: number|null
}
type PickRow = { team_id: string; points?: number|null; locked?: boolean }
type Team = {
  id:string; name:string; abbreviation:string;
  color_primary?:string|null; color_secondary?:string|null;
  color_tertiary?:string|null; color_quaternary?:string|null;
  color_pref_light?: 'primary'|'secondary'|'tertiary'|'quaternary'|null;
  color_pref_dark?:  'primary'|'secondary'|'tertiary'|'quaternary'|null;
  logo?:string|null; logo_dark?:string|null;
}

function parseHex(hex?: string|null) {
  if (!hex) return null
  const s = hex.trim().replace('#','')
  if (![3,6].includes(s.length)) return null
  const v = s.length===3 ? s.split('').map(c=>c+c).join('') : s
  const r = parseInt(v.slice(0,2),16), g = parseInt(v.slice(2,4),16), b = parseInt(v.slice(4,6),16)
  return { r, g, b }
}
function relL({r,g,b}:{r:number;g:number;b:number}) {
  const f=(c:number)=>{ c/=255; return c<=0.03928? c/12.92 : Math.pow((c+0.055)/1.055, 2.4) }
  const R=f(r), G=f(g), B=f(b); return 0.2126*R + 0.7152*G + 0.0722*B
}
function contrast(bgHex:string, textHex:string) {
  const bg=parseHex(bgHex), tx=parseHex(textHex); if(!bg||!tx) return 0
  const L1=relL(bg)+0.05, L2=relL(tx)+0.05
  return L1>L2 ? L1/L2 : L2/L1
}
function textOn(bgHex?:string|null) {
  const bg = bgHex || '#e5e7eb'
  return contrast(bg, '#000000') >= contrast(bg, '#ffffff') ? '#000000' : '#ffffff'
}
function tint(hex?:string|null, amt=0.90) {
  const c=parseHex(hex); if(!c) return '#e5e7eb'
  const r=Math.round(c.r+(255-c.r)*amt), g=Math.round(c.g+(255-c.g)*amt), b=Math.round(c.b+(255-c.b)*amt)
  return `rgb(${r}, ${g}, ${b})`
}
function usePrefersDark() {
  const [dark,setDark]=useState(false)
  useEffect(()=>{
    const mq=window.matchMedia?.('(prefers-color-scheme: dark)')
    const sync=()=>setDark(!!mq?.matches); sync()
    mq?.addEventListener?.('change', sync)
    return ()=>mq?.removeEventListener?.('change', sync)
  },[])
  return dark
}
function colorByKey(t?:Team, key?:string|null) {
  if (!t) return null
  switch (key) {
    case 'primary': return t.color_primary
    case 'secondary': return t.color_secondary
    case 'tertiary': return t.color_tertiary
    case 'quaternary': return t.color_quaternary
    default: return null
  }
}
function teamBaseColor(t?:Team, dark=false) {
  const pref = dark ? t?.color_pref_dark : t?.color_pref_light
  const chosen = colorByKey(t, pref||undefined)
  if (chosen) return chosen
  return t?.color_primary || t?.color_secondary || t?.color_tertiary || t?.color_quaternary || '#e5e7eb'
}

function Card({ title, action, children }:{
  title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title ? <h2 className="text-base font-semibold">{title}</h2> : <span />}
          {action}
        </header>
      )}
      <div>{children}</div>
    </section>
  )
}

export default function Home() {
  const prefersDark = usePrefersDark()

  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState<string>('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number>(1)
  const [games, setGames] = useState<Game[]>([])
  const [picks, setPicks] = useState<PickRow[]>([])
  const [stand, setStand] = useState<StandingRow[]>([])
  const [teams, setTeams] = useState<Record<string, Team>>({})
  const [teamsReady, setTeamsReady] = useState(false)
  const [loading, setLoading] = useState(false)

  // Load leagues and team map
  useEffect(() => {
    fetch('/api/my-leagues').then(r=>r.json()).then(j=>{
      const ls: League[] = j.leagues || []
      setLeagues(ls)
      if (!leagueId && ls[0]) { setLeagueId(ls[0].id); setSeason(ls[0].season) }
    })
    fetch('/api/team-map')
      .then(r=>r.json())
      .then(j=> { setTeams(j.teams || {}); setTeamsReady(true) })
      .catch(()=> setTeamsReady(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load games/picks/standings for the selected league/week
  useEffect(() => {
    if (!leagueId || !season || !week) return
    ;(async () => {
      setLoading(true)
      const [g, p, s] = await Promise.all([
        fetch(`/api/games-for-week?season=${season}&week=${week}`).then(r=>r.json()),
        fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`).then(r=>r.json()),
        fetch(`/api/standings?leagueId=${leagueId}&season=${season}`).then(r=>r.json()),
      ])
      setGames((g?.games || []).map((x:any)=>({
        id:x.id,
        start_time:x.start_time||x.game_utc,
        status:x.status||'UPCOMING',
        week:x.week,
        home:x.home, away:x.away,
        home_score: x.home_score ?? x.home?.score ?? null,
        away_score: x.away_score ?? x.away?.score ?? null,
      })))
      setPicks(p?.picks || [])
      setStand(s?.standings || [])
      setLoading(false)
    })()
  }, [leagueId, season, week])

  const picksUsed = picks.length
  const ptsThisWeek = picks.reduce((n, r)=> n + (r.points ?? 0), 0)
  const remaining = Math.max(0, 2 - picksUsed)
  const picked = useMemo(()=> new Set(picks.map(p=>p.team_id)), [picks])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">NFL Pick’em</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Welcome! Use the Admin page to import teams & schedule, then come back to make picks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className="h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                  value={leagueId} onChange={e=>setLeagueId(e.target.value)}>
            <option value="" disabled>Choose league…</option>
            {leagues.map(l=> <option key={l.id} value={l.id}>{l.name} · {l.season}</option>)}
          </select>
          <input className="h-9 w-20 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                 type="number" value={season} onChange={e=>setSeason(+e.target.value)}/>
          <input className="h-9 w-16 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                 type="number" value={week} onChange={e=>setWeek(+e.target.value)}/>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT 2/3 */}
        <div className="lg:col-span-2 grid gap-5">
          <Card title="League Overview" action={<Link className="text-sm underline underline-offset-2" href="/picks">Make picks →</Link>}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
                <div className="text-sm text-neutral-500">Picks used</div>
                <div className="text-2xl font-bold">{picksUsed}/2</div>
              </div>
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
                <div className="text-sm text-neutral-500">Points (wk)</div>
                <div className="text-2xl font-bold">{ptsThisWeek}</div>
              </div>
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
                <div className="text-sm text-neutral-500">Remaining</div>
                <div className="text-2xl font-bold">{remaining}</div>
              </div>
            </div>
          </Card>

          <Card title={`Week ${week} — Games`} action={<Link className="text-sm underline underline-offset-2" href="/picks">Make picks →</Link>}>
            {loading && <div className="text-sm text-neutral-500">Loading…</div>}
            {!loading && games.length===0 && <div className="text-sm text-neutral-500">No games.</div>}
            <div className="grid gap-4">
              {games.map(g => {
                const home: Team|undefined = teams[g.home?.id]
                const away: Team|undefined = teams[g.away?.id]
                const homeBase = teamBaseColor(home, prefersDark)
                const awayBase = teamBaseColor(away, prefersDark)
                const homeBg = tint(homeBase, 0.90)
                const awayBg = tint(awayBase, 0.90)
                const homeText = textOn(homeBg)
                const awayText = textOn(awayBg)
                const homeLogo = prefersDark ? (home?.logo_dark || home?.logo) : (home?.logo || home?.logo_dark)
                const awayLogo = prefersDark ? (away?.logo_dark || away?.logo) : (away?.logo || away?.logo_dark)
                const homePicked = picked.has(home?.id ?? '')
                const awayPicked = picked.has(away?.id ?? '')
                const final = (g.status||'').toUpperCase().includes('FINAL')
                const homeScore = (g.home_score ?? null)
                const awayScore = (g.away_score ?? null)

                return (
                  <div key={g.id} className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
                    <div className="mb-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                      <span>{g.start_time ? new Date(g.start_time).toLocaleString() : '—'}</span>
                      <span className="uppercase tracking-wide">{g.status || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 rounded-full px-3 py-2 border transition-[border-width]"
                           style={{ background: homeBg, color: homeText, borderColor: homeBase, borderWidth: homePicked ? 2 : 1 }}>
                        <div className="flex items-center gap-2">
                          {homeLogo && <img src={homeLogo} alt="" width={18} height={18} className="rounded" />}
                          <span className="font-semibold">
                            {home?.abbreviation ? `${home.abbreviation} — ` : ''}{home?.name || g.home?.name || '—'}
                          </span>
                        </div>
                      </div>
                      <div className="text-neutral-400">—</div>
                      <div className="flex-1 rounded-full px-3 py-2 border transition-[border-width]"
                           style={{ background: awayBg, color: awayText, borderColor: awayBase, borderWidth: awayPicked ? 2 : 1 }}>
                        <div className="flex items-center gap-2">
                          {awayLogo && <img src={awayLogo} alt="" width={18} height={18} className="rounded" />}
                          <span className="font-semibold">
                            {away?.abbreviation ? `${away.abbreviation} — ` : ''}{away?.name || g.away?.name || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                      {final && (homeScore!=null && awayScore!=null)
                        ? <>Score: {homeScore} — {awayScore}</>
                        : <>Score: — — —</>}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* RIGHT 1/3 */}
        <div className="grid gap-5">
          <Card title={`My picks — Week ${week}`} action={<Link className="text-sm underline underline-offset-2" href="/standings">Standings →</Link>}>
            {!teamsReady ? (
              <div className="text-sm text-neutral-500">Loading teams…</div>
            ) : picks.length === 0 ? (
              <div className="text-sm text-neutral-500">No pick</div>
            ) : (
              <ul className="text-sm grid gap-2">
                {picks.map((p, i) => {
                  const t = teams[p.team_id]
                  // if something is off, we still fall back to the id
                  const title = t ? `${t.abbreviation ? t.abbreviation + ' — ' : ''}${t.name}` : p.team_id
                  const base = teamBaseColor(t, prefersDark)
                  const bg = tint(base, 0.90)
                  const fg = textOn(bg)
                  const logo = prefersDark ? (t?.logo_dark || t?.logo) : (t?.logo || t?.logo_dark)
                  return (
                    <li key={i} className="flex items-center justify-between rounded-lg border px-3 py-2"
                        style={{ background: bg, color: fg, borderColor: base }}>
                      <span className="font-medium flex items-center gap-2 truncate">
                        {logo && <img src={logo} alt="" width={16} height={16} className="rounded" />}
                        <span className="truncate">{title}</span>
                      </span>
                      <span className="text-xs opacity-70">{p.locked ? 'Locked' : (p.points ?? 0)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card title="League snapshot" action={<Link className="text-sm underline underline-offset-2" href="/standings">Standings →</Link>}>
            <table className="w-full text-sm">
              <thead className="text-neutral-500">
                <tr><th className="text-left font-medium py-1">#</th><th className="text-left font-medium py-1">Team</th><th className="text-right font-medium py-1">Pts</th></tr>
              </thead>
              <tbody>
                {stand.slice(0,5).map((r, i) => (
                  <tr key={r.profile_id} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="py-1">{i+1}</td>
                    <td className="py-1">{r.profiles?.display_name || r.profiles?.email || r.profile_id}</td>
                    <td className="py-1 text-right">{r.points}</td>
                  </tr>
                ))}
                {stand.length === 0 && (
                  <tr className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="py-1">—</td><td className="py-1">No data yet.</td><td className="py-1 text-right">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          <Card title="Team usage">
            <div className="text-sm text-neutral-500">No teams.</div>
          </Card>
        </div>
      </div>
    </div>
  )
}

