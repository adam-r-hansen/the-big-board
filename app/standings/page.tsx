// app/standings/page.tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type League = { id: string; name: string; season: number }
type Team = { id: string; abbreviation: string | null; name?: string | null }
type Row = {
  team_id?: string
  team?: string
  team_abbreviation?: string
  wins?: number
  losses?: number
  ties?: number
  pct?: number
  points_for?: number
  points_against?: number
  rank?: number
}

export default function StandingsPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())

  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    ;(async () => {
      const lj = await fetch('/api/my-leagues', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))
      const ls: League[] = lj?.leagues || []
      setLeagues(ls)
      if (ls.length === 1) {
        setLeagueId(ls[0].id)
        setSeason(ls[0].season)
      } else if (ls[0]) {
        setLeagueId(ls[0].id)
        setSeason(ls[0].season)
      }
      const tm = await fetch('/api/team-map', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))
      setTeamMap(tm?.teams || {})
    })()
  }, [])

  const singleLeague = leagues.length === 1
  const noLeagues = leagues.length === 0

  useEffect(() => {
    if (!leagueId || !season) return
    ;(async () => {
      setLoading(true); setMsg('')
      try {
        const j = await fetch(`/api/standings?leagueId=${leagueId}&season=${season}`, { cache: 'no-store' }).then(r => r.json())
        const data = Array.isArray(j) ? j : (j?.standings || j?.rows || [])
        const norm: Row[] = data.map((r: any) => ({
          team_id: r.team_id ?? r.teamId ?? r.team ?? r.id ?? undefined,
          team: r.team_name ?? r.team ?? undefined,
          team_abbreviation: r.team_abbreviation ?? r.abbreviation ?? undefined,
          wins: r.wins ?? r.W ?? r.w ?? 0,
          losses: r.losses ?? r.L ?? r.l ?? 0,
          ties: r.ties ?? r.T ?? r.t ?? 0,
          pct: r.pct ?? r.percentage ?? undefined,
          points_for: r.points_for ?? r.pf ?? undefined,
          points_against: r.points_against ?? r.pa ?? undefined,
          rank: r.rank ?? r.position ?? undefined,
        }))
        setRows(norm)
      } catch (e: any) {
        setMsg(e?.message || 'Failed to load standings')
      } finally {
        setLoading(false)
      }
    })()
  }, [leagueId, season])

  function teamDisplay(r: Row) {
    const byId = r.team_id ? teamMap[r.team_id] : undefined
    const abbr = byId?.abbreviation ?? r.team_abbreviation ?? '—'
    const name = byId?.name ?? r.team ?? ''
    return { abbr, name }
  }

  const table = useMemo(() => {
    const computed = rows.map(r => {
      const g = (r.wins || 0) + (r.losses || 0) + (r.ties || 0)
      const pct = typeof r.pct === 'number' ? r.pct : (g ? ((r.wins || 0) + 0.5 * (r.ties || 0)) / g : 0)
      return { ...r, pct }
    })
    computed.sort((a, b) => {
      if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0)
      if ((b.pct || 0) !== (a.pct || 0)) return (b.pct || 0) - (a.pct || 0)
      return (b.points_for || 0) - (a.points_for || 0)
    })
    return computed.map((r, i) => ({ ...r, rank: i + 1 }))
  }, [rows])

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <section className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Standings</h1>
        <div className="ml-auto flex items-center gap-3">
          <Link className="underline text-sm" href="/picks">Picks</Link>

          {noLeagues ? null : singleLeague ? (
            <span className="text-sm text-neutral-600">
              League: <strong>{leagues[0].name}</strong>
            </span>
          ) : (
            <>
              <select className="border rounded px-2 py-1 bg-transparent" value={leagueId} onChange={e => setLeagueId(e.target.value)}>
                {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <select className="border rounded px-2 py-1 bg-transparent" value={season} onChange={e => setSeason(Number(e.target.value))}>
                {Array.from({length:3}).map((_,i)=> {
                  const yr = new Date().getFullYear()-1+i
                  return <option key={yr} value={yr}>{yr}</option>
                })}
              </select>
            </>
          )}
        </div>
      </section>

      {noLeagues ? (
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
          <h2 className="text-lg font-semibold mb-2">No leagues found</h2>
          <p className="text-sm text-neutral-600">Ask your commissioner for an invite link.</p>
        </section>
      ) : (
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Overall standings</h2>
            <span className="text-xs text-neutral-500">{loading ? 'Loading…' : msg}</span>
          </header>

          {table.length === 0 ? (
            <div className="text-sm text-neutral-500">{loading ? 'Loading…' : 'No rows.'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-neutral-500">
                  <tr>
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Team</th>
                    <th className="py-2 pr-3">W</th>
                    <th className="py-2 pr-3">L</th>
                    <th className="py-2 pr-3">T</th>
                    <th className="py-2 pr-3">Pct</th>
                    <th className="py-2 pr-3">PF</th>
                    <th className="py-2 pr-3">PA</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map(r => {
                    const d = teamDisplay(r)
                    return (
                      <tr key={`${r.team_id ?? d.abbr}-${r.rank}`} className="border-t">
                        <td className="py-2 pr-3">{r.rank}</td>
                        <td className="py-2 pr-3"><span className="font-medium">{d.abbr}</span>{d.name ? ` — ${d.name}` : ''}</td>
                        <td className="py-2 pr-3">{r.wins ?? 0}</td>
                        <td className="py-2 pr-3">{r.losses ?? 0}</td>
                        <td className="py-2 pr-3">{r.ties ?? 0}</td>
                        <td className="py-2 pr-3">{(r.pct ?? 0).toFixed(3)}</td>
                        <td className="py-2 pr-3">{r.points_for ?? '—'}</td>
                        <td className="py-2 pr-3">{r.points_against ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
