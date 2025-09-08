// app/picks/page.tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import SpecialPicksCard from '@/components/SpecialPicksCard'
import TeamPill from '@/components/TeamPill'

type League = { id: string; name: string; season: number }
type Team = {
  id: string
  abbreviation: string | null
  name?: string | null
  color_primary?: string | null
  color_secondary?: string | null
  color_tertiary?: string | null
  color_quaternary?: string | null
  logo?: string | null
  logo_dark?: string | null
}
type TeamLike = {
  id?: string
  abbreviation?: string
  name?: string
  color_primary?: string
  color_secondary?: string
  logo?: string
  logo_dark?: string
}
type Game = {
  id: string
  season: number
  week: number
  game_utc: string
  status: string | null
  home: { id?: string; abbr?: string | null }
  away: { id?: string; abbr?: string | null }
}
type Pick = { id: string; team_id: string; game_id: string | null }

function SectionCard({ children, title, right }: { children: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </header>
      {children}
    </section>
  )
}

export default function Page() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState<string | null>(null)
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number>(1)

  const [games, setGames] = useState<Game[]>([])
  const [picks, setPicks] = useState<Pick[]>([])
  const [teamMap, setTeamMap] = useState<Record<string, TeamLike>>({})
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string>('')

  const pickByGame = useMemo(() => {
    const m = new Map<string, Pick>()
    for (const p of picks) if (p.game_id) m.set(p.game_id, p)
    return m
  }, [picks])

  const picksLeft = useMemo(() => {
    const used = picks.filter((p) => p.game_id).length
    return Math.max(0, 2 - used)
  }, [picks])

  const teamIndex = useMemo(() => {
    const idx: Record<string, Team> = {}
    Object.values(teamMap || {}).forEach((t: any) => {
      if (!t) return
      const id = (t.id || '').toString()
      const abbr = (t.abbreviation || t.abbr || '').toUpperCase()
      const norm: Team = {
        id,
        abbreviation: abbr || null,
        name: t.name ?? null,
        color_primary: t.color_primary ?? null,
        color_secondary: t.color_secondary ?? null,
        color_tertiary: t.color_tertiary ?? null,
        color_quaternary: t.color_quaternary ?? null,
        logo: t.logo ?? null,
        logo_dark: t.logo_dark ?? null,
        color_pref_light: (t.color_pref_light as any) ?? null,
        color_pref_dark: (t.color_pref_dark as any) ?? null,
      } as any
        ; (idx[id] = norm)
      if (abbr) idx[abbr] = norm
    })
    return idx
  }, [teamMap])

  function resolve(input?: { id?: string; abbr?: string | null }) {
    if (!input) return { team: null as Team | null, teamId: null as string | null }
    const a = (input.abbr || '').toUpperCase()
    const t = (input.id && teamIndex[input.id]) || (a && teamIndex[a]) || null
    const id = (t?.id as string) || input.id || null
    return { team: t, teamId: id }
  }

  const isLocked = (utc?: string) => (utc ? new Date(utc) <= new Date() : false)
  async function safeJson(res: Response) {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      try { return await res.json() } catch { return null }
    }
    return null
  }

  async function refreshMyPicks() {
    const j = await fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' }).then(r => r.json())
    setPicks((j.picks ?? []).map((r: any) => ({ id: r.id, team_id: r.team_id, game_id: r.game_id })))
  }
  async function deletePickById(pickId: string) {
    const res = await fetch(`/api/picks?id=${pickId}`, { method: 'DELETE', cache: 'no-store' })
    if (!res.ok) throw new Error((await safeJson(res))?.error || 'Unpick failed')
  }
  async function togglePick(teamId: string, gameId: string) {
    setMsg('')
    const existing = pickByGame.get(gameId)
    if (existing) {
      try { await deletePickById(existing.id); await refreshMyPicks() } catch (e: any) { setMsg(e?.message || 'Unpick failed') }
      return
    }
    try {
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leagueId, season, week, teamId, gameId }),
        cache: 'no-store',
      })
      const j = await safeJson(res)
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`)
      await refreshMyPicks()
    } catch (e: any) {
      setMsg(e?.message || 'Pick failed')
    }
  }

  async function loadLeagues() {
    try {
      const ls: League[] = await fetch('/api/leagues', { cache: 'no-store' }).then(r => r.json())
      setLeagues(ls)
      if (ls.length === 1) {
        setLeagueId(ls[0].id)
        setSeason(ls[0].season)
      } else if (!leagueId && ls[0]) {
        setLeagueId(ls[0].id)
        setSeason(ls[0].season)
      }
    } catch (e: any) {
      setMsg(e?.message || 'Failed to load leagues')
    }
  }

  useEffect(() => {
    loadLeagues()
    fetch('/api/team-map').then(r => r.json()).then(j => setTeamMap(j.teams || {})).catch(() => {})
  }, [])

  useEffect(() => {
    if (!leagueId) return
    setLoading(true)
    setMsg('')
    Promise.all([
      fetch(`/api/schedule?season=${season}&week=${week}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' }).then(r => r.json()),
    ])
      .then(([sched, mp]) => {
        const games: Game[] = (sched.games || []).map((g: any) => ({
          id: g.id,
          season: g.season,
          week: g.week,
          game_utc: g.game_utc,
          status: g.status || null,
          home: { id: g.home_team_id, abbr: (g.home_abbr || g.home?.abbr || g.home?.abbreviation || '').toUpperCase() },
          away: { id: g.away_team_id, abbr: (g.away_abbr || g.away?.abbr || g.away?.abbreviation || '').toUpperCase() },
        }))
        setGames(games)
        setPicks((mp.picks ?? []).map((r: any) => ({ id: r.id, team_id: r.team_id, game_id: r.game_id })))
      })
      .catch((e) => setMsg((e as any)?.message || 'Failed to load week'))
      .finally(() => setLoading(false))
  }, [leagueId, season, week])

  const [invite, setInvite] = useState('')
  const [joining, setJoining] = useState(false)
  function extractLeagueId(s: string) {
    const m = s.match(/[0-9a-fA-F-]{36}/)
    return m ? m[0] : null
  }

  async function joinFromInvite() {
    const id = extractLeagueId(invite)
    if (!id) { setMsg('Please paste an invite link or league id'); return }
    setJoining(true); setMsg('')
    try {
      const res = await fetch('/api/leagues/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leagueId: id }),
        cache: 'no-store',
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`)
      setInvite('')
      await loadLeagues()
      setMsg('Joined! Select your league above.')
    } catch (e: any) {
      setMsg(e?.message || 'Join failed')
    } finally {
      setJoining(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <section className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Make your picks</h1>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm">League:</label>
          <select
            value={leagueId ?? ''}
            onChange={(e) => setLeagueId(e.target.value)}
            className="rounded border bg-transparent px-2 py-1"
          >
            <option value="" disabled>Select a league</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>{l.name} ({l.season})</option>
            ))}
          </select>

          <label className="text-sm ml-3">Season:</label>
          <input type="number" className="w-24 rounded border bg-transparent px-2 py-1" value={season} onChange={(e) => setSeason(parseInt(e.target.value || '0', 10))} />

          <label className="text-sm ml-3">Week:</label>
          <input type="number" className="w-16 rounded border bg-transparent px-2 py-1" value={week} onChange={(e) => setWeek(parseInt(e.target.value || '0', 10))} />
        </div>
      </section>

      {/* Join helper if no league selected */}
      {!leagueId ? (
        <section className="grid gap-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Paste your invite link or league ID to join, then select your league above.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              className="border rounded px-3 py-2 bg-transparent flex-1"
              placeholder="https://…/join?leagueId=…  or  00000000-0000-0000-0000-000000000000"
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
            />
            <button className="px-4 py-2 rounded-lg border disabled:opacity-50" disabled={joining} onClick={joinFromInvite}>
              {joining ? 'Joining…' : 'Join'}
            </button>
          </div>
          {msg && <div className="text-xs mt-3">{msg}</div>}
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT 2/3 — Wrinkle + Weekly */}
          <div className="lg:col-span-8 grid gap-6">
            <SpecialPicksCard leagueId={leagueId} season={season} week={week} teams={teamIndex} />

            <SectionCard title={`Week ${week} — ${picksLeft} of 2 picks available`} right={<span className="text-xs text-neutral-500">{msg}</span>}>
              {loading && <div className="text-sm text-neutral-500">Loading…</div>}
              {!loading && games.length === 0 && <div className="text-sm text-neutral-500">No games.</div>}

              {games.map((g) => {
                const { team: homeTeam, teamId: homeId } = resolve(g.home)
                const { team: awayTeam, teamId: awayId } = resolve(g.away)

                const locked = isLocked(g.game_utc)
                const existing = pickByGame.get(g.id)
                const weeklyQuotaFull = (picks?.length ?? 0) >= 2 && !existing

                return (
                  <article key={g.id} className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                      <span>{new Date(g.game_utc).toLocaleString()} • Week {g.week}</span>
                      <span className="uppercase tracking-wide">{locked ? 'LOCKED' : g.status || 'UPCOMING'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <TeamPill
                          team={homeTeam as Team}
                          picked={!!existing && existing.team_id === homeId}
                          disabled={locked || weeklyQuotaFull || !homeId}
                          onClick={() => homeId && togglePick(homeId, g.id)}
                        />
                      </div>
                      <div className="text-neutral-400">—</div>
                      <div className="flex-1">
                        <TeamPill
                          team={awayTeam as Team}
                          picked={!!existing && existing.team_id === awayId}
                          disabled={locked || weeklyQuotaFull || !awayId}
                          onClick={() => awayId && togglePick(awayId, g.id)}
                        />
                      </div>
                    </div>
                  </article>
                )
              })}
            </SectionCard>
          </div>

          {/* RIGHT 1/3 — My picks */}
          <aside className="lg:col-span-4 grid gap-6">
            <SectionCard title={`My picks — Week ${week}`}>
              {picks.length === 0 ? (
                <div className="text-sm text-neutral-500">No picks yet.</div>
              ) : (
                <ul className="text-sm grid gap-2">
                  {picks.map((p) => {
                    const t = teamIndex[p.team_id] || teamIndex[(teamIndex[p.team_id]?.abbreviation || '').toUpperCase()]
                    const locked = p.game_id ? isLocked(games.find((g) => g.id === p.game_id)?.game_utc) : false
                    return (
                      <li key={p.id} className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2">
                        <span className="font-medium flex items-center gap-2">{t?.abbreviation ?? p.team_id} — {t?.name ?? ''}</span>
                        <button
                          className="text-xs underline disabled:opacity-50"
                          disabled={locked}
                          onClick={async () => {
                            try { await deletePickById(p.id); await refreshMyPicks(); setMsg('') }
                            catch (e: any) { const m = e?.message || 'Unpick failed'; setMsg(m); console.error('unpick error', m) }
                          }}
                          title={locked ? 'Locked (kickoff passed)' : 'Unpick'}
                        >
                          {locked ? 'Locked' : 'Unpick'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </SectionCard>
          </aside>
        </div>
      )}
    </main>
  )
}
