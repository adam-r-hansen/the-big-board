'use client'
import { useEffect, useMemo, useState } from 'react'

type League = { id: string; name: string; season: number }
type Wrinkle = {
  id: string
  league_id: string
  season: number
  week: number
  name: string
  status: 'active'|'inactive'
  extra_picks: number
  auto_hydrate: boolean
  created_at?: string
}

function InputRow(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-neutral-600 dark:text-neutral-400">{props.label}</span>
      {props.children}
    </label>
  )
}

export default function WrinklesAdminPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number>(1)
  const [name, setName] = useState('Bonus Pick')
  const [extraPicks, setExtraPicks] = useState<number>(1)
  const [autoHydrate, setAutoHydrate] = useState<boolean>(true)
  const [activeWrinkles, setActiveWrinkles] = useState<Wrinkle[]>([])
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState('')

  useEffect(() => {
    fetch('/api/my-leagues').then(r=>r.json()).then(j=>{
      const ls: League[] = j.leagues ?? []
      setLeagues(ls)
      if (!leagueId && ls[0]) { setLeagueId(ls[0].id); setSeason(ls[0].season) }
    })
  }, [])

  useEffect(() => {
    if (!leagueId || !season || !week) return
    void reloadActive()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, season, week])

  async function reloadActive() {
    setLog('')
    try {
      const url = `/api/wrinkles/active?leagueId=${leagueId}&season=${season}&week=${week}`
      const res = await fetch(url, { cache: 'no-store' })
      const j = await res.json()
      setActiveWrinkles(j.wrinkles ?? [])
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'Failed to load active wrinkles')
    }
  }

  async function createWrinkle() {
    setBusy(true); setLog('')
    try {
      const payload = {
        leagueId, season, week,
        name,
        status: 'active',
        extraPicks,
        autoHydrate,
      }
      const res = await fetch('/api/admin/wrinkles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error ?? 'Create failed')
      await reloadActive()
      setLog(`Created wrinkle: ${j.wrinkle?.name ?? name}`)
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  async function hydrate(id: string) {
    setBusy(true); setLog('')
    try {
      const res = await fetch(`/api/admin/wrinkles/${id}/hydrate`, { method: 'POST' })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error ?? 'Hydrate failed')
      setLog(`Hydrated games: inserted ${j.inserted ?? 0}${j.updated ? `, updated ${j.updated}` : ''}`)
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'Hydrate failed')
    } finally {
      setBusy(false)
    }
  }

  const league = useMemo(() => leagues.find(l=>l.id===leagueId), [leagues, leagueId])

  return (
    <main className="mx-auto max-w-4xl p-6 grid gap-6">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Wrinkles Admin</h1>
        <span className="text-sm text-neutral-500">Create & hydrate weekly specials</span>
      </header>

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 grid gap-4">
        <div className="grid md:grid-cols-4 gap-4">
          <InputRow label="League">
            <select className="h-10 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2"
                    value={leagueId} onChange={e=>setLeagueId(e.target.value)}>
              <option value="" disabled>Choose…</option>
              {leagues.map(l=> <option key={l.id} value={l.id}>{l.name} · {l.season}</option>)}
            </select>
          </InputRow>
          <InputRow label="Season">
            <input type="number" value={season} onChange={e=>setSeason(+e.target.value)}
                   className="h-10 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2" />
          </InputRow>
          <InputRow label="Week">
            <input type="number" value={week} onChange={e=>setWeek(+e.target.value)}
                   className="h-10 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2" />
          </InputRow>
          <InputRow label="Name">
            <input value={name} onChange={e=>setName(e.target.value)}
                   className="h-10 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2" />
          </InputRow>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <InputRow label="Extra Picks">
            <input type="number" min={0} value={extraPicks} onChange={e=>setExtraPicks(+e.target.value)}
                   className="h-10 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2" />
          </InputRow>
          <InputRow label="Auto-hydrate games?">
            <select className="h-10 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2"
                    value={autoHydrate ? 'true' : 'false'}
                    onChange={e=>setAutoHydrate(e.target.value === 'true')}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </InputRow>
          <div className="grid items-end">
            <button
              disabled={!leagueId || busy}
              onClick={createWrinkle}
              className="h-10 rounded-lg bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Create Wrinkle'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 grid gap-3">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Active for Week {week}{league ? ` — ${league.name}` : ''}</h2>
          <button onClick={()=>void reloadActive()} className="text-sm underline">Refresh</button>
        </header>
        {activeWrinkles.length === 0 ? (
          <div className="text-sm text-neutral-500">No active wrinkles for this week.</div>
        ) : (
          <ul className="grid gap-3">
            {activeWrinkles.map(w => (
              <li key={w.id} className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2">
                <div className="text-sm">
                  <div className="font-medium">{w.name}</div>
                  <div className="text-neutral-500">extra picks: {w.extra_picks} · auto: {w.auto_hydrate ? 'yes' : 'no'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={()=>void hydrate(w.id)}
                    className="h-9 px-3 rounded-md border border-neutral-300 dark:border-neutral-700"
                  >
                    Hydrate Games
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {log && <pre className="text-xs p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">{log}</pre>}
    </main>
  )
}
