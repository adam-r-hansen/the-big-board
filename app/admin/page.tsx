// app/admin/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TeamPillColors from '@/components/admin/TeamPillColors'

type League = { id: string; name: string; season: number }
type Profile = { id: string; email?: string; display_name?: string | null }
type Unassigned = { id: string; email: string; display_name?: string | null }
type WrinkleInput = { name: string; description?: string; extra_picks?: number; week?: number }
type Team = { id: string; abbreviation?: string }

type WrinkleAdmin = {
  id: string
  league_id: string
  season: number
  week: number
  name: string
  status: string
  extra_picks: number
  kind: string
}

type GameLite = {
  id: string
  season: number
  week: number
  game_utc?: string
  status?: string
  home?: { id?: string; abbr?: string | null }
  away?: { id?: string; abbr?: string | null }
  home_team?: string | null
  away_team?: string | null
  home_abbr?: string | null
  away_abbr?: string | null
}

// ─── Small UI bits ───────────────────────────────────────────────────────────────
function Card(props: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{props.title}</h2>
        {props.right}
      </header>
      {props.children}
    </section>
  )
}

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props
  return (
    <button
      {...rest}
      className={[
        'px-3 py-2 rounded-xl border font-medium',
        'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      ].join(' ')}
    />
  )
}

function Segmented({
  value,
  onChange,
  items,
}: {
  value: string
  onChange: (v: string) => void
  items: { label: string; value: string }[]
}) {
  return (
    <div className="inline-flex rounded-xl border border-neutral-300 dark:border-neutral-700 overflow-hidden">
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={[
            'px-3 py-1.5 text-sm',
            value === it.value
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
              : 'bg-white dark:bg-neutral-900',
          ].join(' ')}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────
async function get<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error()
  return res.json()
}

async function post<T = any>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }

  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) ||
      
    throw new Error(msg)
  }

  return data
}

function gameLabel(g: GameLite, teamIndex: Record<string, { abbreviation?: string }>) {
  const homeAbbr =
    g.home?.abbr ??
    (g.home?.id ? teamIndex[g.home.id]?.abbreviation : undefined) ??
    g.home_abbr ??
    (g.home_team ? teamIndex[g.home_team]?.abbreviation : undefined) ??
    'HOME'

  const awayAbbr =
    g.away?.abbr ??
    (g.away?.id ? teamIndex[g.away.id]?.abbreviation : undefined) ??
    g.away_abbr ??
    (g.away_team ? teamIndex[g.away_team]?.abbreviation : undefined) ??
    'AWAY'

  const when = g.game_utc ?  : ''
  return 
}

// ─── Main Admin Page ─────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [mode, setMode] = useState<'app' | 'league'>('league')

  const [leagues, setLeagues] = useState<League[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [teamIndex, setTeamIndex] = useState<Record<string, Team>>({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')

  const [leagueId, setLeagueId] = useState('')
  const [seasonWrinkles, setSeasonWrinkles] = useState<WrinkleAdmin[]>([])
  const [seasonFilter, setSeasonFilter] = useState<number>(new Date().getFullYear())

  const [gamesByWrinkle, setGamesByWrinkle] = useState<Record<string, GameLite[]>>({})
  const [selectedGameId, setSelectedGameId] = useState<Record<string, string>>({})
  const [savingFor, setSavingFor] = useState('')

  function flash(s: string) {
    setMsg(s)
    setTimeout(() => setMsg(''), 3000)
  }

  useEffect(() => {
    ;(async () => {
      try {
        const lj = await get<{ leagues: League[] }>('/api/my-leagues')
        const ls = lj?.leagues || []
        setLeagues(ls)
        if (!leagueId && ls[0]) setLeagueId(ls[0].id)
      } catch (e: any) {
        flash()
      }
      try {
        const tm = await get<any>('/api/team-map')
        const arr = Object.values(tm?.teams || {}) as any[]
        const compact = arr.map((x: any) => ({ id: x.id, abbreviation: x.abbreviation }))
        setTeams(compact)
        const idx: Record<string, Team> = {}
        for (const t of compact) idx[t.id] = t
        setTeamIndex(idx)
      } catch {}
    })()
  }, [leagueId])

  async function refreshWrinkles() {
    if (!leagueId || !seasonFilter) return
    try {
      const j = await get<any>()
      setSeasonWrinkles(Array.isArray(j?.wrinkles) ? j.wrinkles : [])
    } catch {
      setSeasonWrinkles([])
    }
  }
  useEffect(() => {
    refreshWrinkles()
  }, [leagueId, seasonFilter])

  async function loadGamesForWrinkle(w: WrinkleAdmin) {
    try {
      const j = await get<any>()
      const rows: GameLite[] = (j?.games || []).map((x: any) => ({
        id: x.id,
        season: x.season,
        week: x.week,
        game_utc: x.game_utc || x.start_time,
        home: {
          id: x.home?.id ?? x.home_team,
          abbr: x.home?.abbreviation ?? x.home_abbr ?? null,
        },
        away: {
          id: x.away?.id ?? x.away_team,
          abbr: x.away?.abbreviation ?? x.away_abbr ?? null,
        },
      }))
      setGamesByWrinkle((m) => ({ ...m, [w.id]: rows }))
      if (!selectedGameId[w.id] && rows[0])
        setSelectedGameId((m) => ({ ...m, [w.id]: rows[0].id }))
    } catch (e: any) {
      flash(e?.message || 'Could not load games')
    }
  }

  async function saveGameForWrinkle(w: WrinkleAdmin) {
    const gid = selectedGameId[w.id]
    if (!gid) return
    setSavingFor(w.id)
    try {
      await post('/api/admin/wrinkle-games', { wrinkleId: w.id, gameId: gid })
      flash('Wrinkle game attached.')
    } catch (e: any) {
      flash(e?.message || 'Save failed')
    } finally {
      setSavingFor('')
    }
  }

  const leagueOptions = useMemo(
    () =>
      leagues.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name} · {l.season}
        </option>
      )),
    [leagues]
  )

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5 flex items-center gap-3">
        <h1 className="text-xl font-bold">League Admin</h1>
        <Segmented
          value={mode}
          onChange={(v) => setMode(v as any)}
          items={[
            { label: 'App', value: 'app' },
            { label: 'League', value: 'league' },
          ]}
        />
        <div className="ml-auto flex items-center gap-3">
          <Link className="underline text-sm" href="/">
            Home
          </Link>
          <Link className="underline text-sm" href="/picks">
            Picks
          </Link>
          <Link className="underline text-sm" href="/standings">
            Standings
          </Link>
        </div>
      </header>

      {msg ? <div className="mb-4 text-sm text-emerald-600">{msg}</div> : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm">League</label>
        <select
          className="border rounded px-2 py-1 bg-transparent"
          value={leagueId}
          onChange={(e) => setLeagueId(e.target.value)}
        >
          {leagueOptions}
        </select>

        <label className="text-sm ml-2">Season</label>
        <select
          className="border rounded px-2 py-1 bg-transparent"
          value={seasonFilter}
          onChange={(e) => setSeasonFilter(Number(e.target.value))}
        >
          {Array.from({ length: 4 }).map((_, i) => {
            const yr = new Date().getFullYear() - 1 + i
            return (
              <option key={yr} value={yr}>
                {yr}
              </option>
            )
          })}
        </select>

        <Button className="ml-2" onClick={refreshWrinkles}>
          Refresh
        </Button>
      </div>

      <Card title={}>
        {seasonWrinkles.length === 0 ? (
          <div className="text-sm text-neutral-500">None for this season.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr>
                  <th className="py-2 pr-4">Week</th>
                  <th className="py-2 pr-4">Kind</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Extra</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Attach game</th>
                </tr>
              </thead>
              <tbody>
                {seasonWrinkles.map((w) => (
                  <tr
                    key={w.id}
                    className="border-t border-neutral-200 dark:border-neutral-800 align-top"
                  >
                    <td className="py-3 pr-4 whitespace-nowrap">Week {w.week}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{w.kind}</td>
                    <td className="py-3 pr-4">{w.name}</td>
                    <td className="py-3 pr-4 text-center">{w.extra_picks || 0}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{w.status}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Button onClick={() => loadGamesForWrinkle(w)}>Load games</Button>
                        <select
                          className="border rounded px-2 py-2 bg-transparent min-w-[260px] max-w-full flex-1"
                          value={selectedGameId[w.id] || ''}
                          onChange={(e) =>
                            setSelectedGameId((m) => ({
                              ...m,
                              [w.id]: e.target.value,
                            }))
                          }
                        >
                          {(gamesByWrinkle[w.id] || []).map((g) => (
                            <option key={g.id} value={g.id}>
                              {gameLabel(g, teamIndex)}
                            </option>
                          ))}
                        </select>
                        <Button
                          disabled={!selectedGameId[w.id] || savingFor === w.id}
                          onClick={() => saveGameForWrinkle(w)}
                        >
                          {savingFor === w.id ? 'Saving…' : 'Save'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  )
}
