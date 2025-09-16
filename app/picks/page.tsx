// app/picks/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import SpecialPicksCard from '@/components/SpecialPicksCard'

type League = { id: string; name: string; season: number }
type Team = {
  id: string
  abbreviation: string | null
  name?: string | null
  color_primary?: string | null
  color_secondary?: string | null
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
  status?: string
  home: { id?: string; abbr?: string | null }
  away: { id?: string; abbr?: string | null }
}
type Pick = { id: string; team_id: string; game_id: string | null }

/* ---------------- NFL Tue→Mon week logic ---------------- */
function firstTuesdayOnOrAfterSept1(seasonYear: number) {
  const d = new Date(seasonYear, 8 /* Sept */, 1, 0, 0, 0, 0)
  const day = d.getDay()
  const delta = (9 - day) % 7
  d.setDate(d.getDate() + delta)
  return d
}
function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function currentNflWeekForSeason(seasonYear: number, today = new Date()): number {
  const anchor = firstTuesdayOnOrAfterSept1(seasonYear)
  if (today.getTime() < anchor.getTime()) return 1
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const diffDays = Math.floor((stripTime(today).getTime() - stripTime(anchor).getTime()) / MS_PER_DAY)
  const week = 1 + Math.floor(diffDays / 7)
  return Math.min(18, Math.max(1, week))
}

/* ---------------- Visual helpers: outline/fill pills ---------------- */
const isHex = (x?: string | null) => !!x && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(x)
const safe = (x: string | null | undefined, fallback: string) => (isHex(x) ? (x as string) : fallback)
function textOn(bg: string) {
  try {
    const hex = bg.replace('#', '')
    const v = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
    const r = parseInt(v.slice(0, 2), 16) / 255
    const g = parseInt(v.slice(2, 4), 16) / 255
    const b = parseInt(v.slice(4, 6), 16) / 255
    const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
    const L = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
    return L > 0.5 ? '#111827' : '#ffffff'
  } catch {
    return '#111827'
  }
}

/** The in-game pick button:
 *  - Outline by default (transparent center, colored border/text)
 *  - Fills with team primary when picked
 *  - Always shows the logo + abbr, compact “pill”
 */
function TeamPickButton({
  team,
  picked,
  disabled,
  onClick,
}: {
  team?: TeamLike
  picked?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  const abbr = team?.abbreviation ?? '—'
  const primary = safe(team?.color_primary, '#6b7280')
  const secondary = safe(team?.color_secondary, '#374151')

  const bg = picked ? primary : 'transparent'
  const fg = picked ? textOn(primary) : primary
  const border = primary

  return (
    <button
      type="button"
      disabled={!!disabled}
      onClick={disabled ? undefined : onClick}
      className={[
        'w-full h-14 rounded-full border px-4 font-semibold tracking-wide',
        'flex items-center gap-2',
        'transition-[transform,opacity] active:scale-[0.98]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90',
      ].join(' ')}
      style={{
        borderColor: border,
        color: fg,
        background: picked ? `linear-gradient(0deg, ${secondary}22, ${primary})` : 'transparent',
      }}
    >
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/95 border border-black/10 overflow-hidden">
        {team?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logo} alt={abbr} className="w-6 h-6 object-contain" />
        ) : (
          <span className="w-4 h-4 rounded-full bg-black/10" />
        )}
      </span>
      <span className="truncate">{abbr}</span>
    </button>
  )
}

/** Compact “PickPill” used in sidebars:
 *  - Solid if `solid` is true (used for “My picks — Week N”)
 *  - Otherwise outline (used for season list)
 */
function PickPill({
  team,
  solid = false,
  right,
  title,
}: {
  team?: TeamLike
  solid?: boolean
  right?: React.ReactNode
  title?: string
}) {
  const abbr = team?.abbreviation ?? '—'
  const primary = safe(team?.color_primary, '#6b7280')
  const secondary = safe(team?.color_secondary, '#374151')
  const bg = solid ? primary : 'transparent'
  const fg = solid ? textOn(primary) : primary
  const bd = primary
  return (
    <span
      title={title}
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1"
      style={{
        borderColor: bd,
        color: fg,
        background: solid ? `linear-gradient(0deg, ${secondary}22, ${primary})` : 'transparent',
      }}
    >
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/95 border border-black/10 overflow-hidden">
        {team?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logo} alt={abbr} className="w-5 h-5 object-contain" />
        ) : (
          <span className="w-3.5 h-3.5 rounded-full bg-black/10" />
        )}
      </span>
      <span className="font-semibold">{abbr}</span>
      {right}
    </span>
  )
}

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

export default function PicksPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number>(1)
  const [userPickedWeek, setUserPickedWeek] = useState(false)

  const [games, setGames] = useState<Game[]>([])
  const [picks, setPicks] = useState<Pick[]>([])
  const [seasonPicks, setSeasonPicks] = useState<Pick[]>([])
  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string>('')

  // Join-by-invite fallback (when no leagues)
  const [invite, setInvite] = useState('')
  const [joining, setJoining] = useState(false)

  // --- Load leagues + teams
  async function loadLeagues() {
    try {
      const j = await fetch('/api/my-leagues', { cache: 'no-store' }).then((r) => r.json())
      const ls: League[] = j.leagues || []
      setLeagues(ls)
      if (!leagueId && ls[0]) {
        setLeagueId(ls[0].id)
        setSeason(ls[0].season)
      } else if (ls.length === 1) {
        setSeason(ls[0].season)
      }
    } catch (e: any) {
      setMsg(e?.message || 'Failed to load leagues')
    }
  }

  useEffect(() => {
    loadLeagues()
    fetch('/api/team-map')
      .then((r) => r.json())
      .then((j) => setTeamMap(j.teams || {}))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-set to current NFL week (Tue→Mon). Stop once user changes week.
  useEffect(() => {
    if (!season || userPickedWeek) return
    const computed = currentNflWeekForSeason(season, new Date())
    if (computed !== week) setWeek(computed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season])

  const singleLeague = leagues.length === 1
  const noLeagues = leagues.length === 0

  const teamIndex: Record<string, TeamLike> = useMemo(() => {
    const idx: Record<string, TeamLike> = {}
    for (const t of Object.values(teamMap)) {
      const v: TeamLike = {
        id: t.id,
        abbreviation: t.abbreviation ?? undefined,
        name: t.name ?? undefined,
        color_primary: t.color_primary ?? undefined,
        color_secondary: t.color_secondary ?? undefined,
        logo: t.logo ?? undefined,
        logo_dark: t.logo_dark ?? undefined,
      }
      if (t.id) idx[t.id] = v
      if (t.abbreviation) idx[t.abbreviation.toUpperCase()] = v
    }
    return idx
  }, [teamMap])

  // --- Load games + weekly picks
  useEffect(() => {
    if (!leagueId || !season || !week) return
    ;(async () => {
      setLoading(true)
      setMsg('')
      try {
        const [g, p] = await Promise.all([
          fetch(`/api/games-for-week?season=${season}&week=${week}`, { cache: 'no-store' }).then((r) => r.json()),
          fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' }).then((r) => r.json()),
        ])
        setGames(
          (g.games ?? []).map((x: any) => ({
            id: x.id,
            game_utc: x.game_utc || x.start_time,
            status: x.status ?? 'UPCOMING',
            season: x.season,
            week: x.week,
            home: {
              id: x.home?.id ?? x.home_team ?? x.homeTeamId ?? x.home_team_id,
              abbr: x.home?.abbreviation ?? x.home_abbr ?? x.homeAbbr ?? x.home?.abbr ?? null,
            },
            away: {
              id: x.away?.id ?? x.away_team ?? x.awayTeamId ?? x.away_team_id,
              abbr: x.away?.abbreviation ?? x.away_abbr ?? x.awayAbbr ?? x.away?.abbr ?? null,
            },
          })),
        )
        setPicks((p.picks ?? p.rows ?? p ?? []).map((r: any) => ({ id: r.id, team_id: r.team_id, game_id: r.game_id })))
      } catch (e: any) {
        setMsg(e?.message || 'Load error')
      } finally {
        setLoading(false)
      }
    })()
  }, [leagueId, season, week])

  // --- Load season picks (robust to multiple API shapes)
  useEffect(() => {
    if (!leagueId || !season) return
    ;(async () => {
      try {
        // Try preferred endpoint
        let res = await fetch(`/api/my-picks-season?leagueId=${leagueId}&season=${season}`, { cache: 'no-store' })
        let j: any = null
        if (res.ok) j = await res.json().catch(() => ({}))
        // Fallback: sometimes “/api/my-picks?leagueId=&season=” (no week) returns all
        if (!res.ok || (!j?.picks && !Array.isArray(j))) {
          const alt = await fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}`, { cache: 'no-store' })
          if (alt.ok) j = await alt.json().catch(() => ({}))
        }
        const arr: any[] = Array.isArray(j?.picks) ? j.picks : Array.isArray(j) ? j : Array.isArray(j?.rows) ? j.rows : []
        setSeasonPicks(arr.map((r: any) => ({ id: r.id, team_id: r.team_id, game_id: r.game_id ?? null })))
      } catch {
        setSeasonPicks([])
      }
    })()
  }, [leagueId, season])

  const picksLeft = Math.max(0, 2 - (picks?.length ?? 0))
  const pickByGame = useMemo(() => {
    const m = new Map<string, Pick>()
    for (const p of picks) if (p.game_id) m.set(p.game_id, p)
    return m
  }, [picks])

  const isLocked = (utc?: string) => (utc ? new Date(utc) <= new Date() : false)
  async function safeJson(res: Response) {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      try {
        return await res.json()
      } catch {
        return null
      }
    }
    return null
  }

  async function refreshMyPicks() {
    const j = await fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`, {
      cache: 'no-store',
    }).then((r) => r.json())
    setPicks((j.picks ?? j.rows ?? j ?? []).map((r: any) => ({ id: r.id, team_id: r.team_id, game_id: r.game_id })))
  }
  async function deletePickById(pickId: string) {
    const res = await fetch(`/api/picks?id=${pickId}`, { method: 'DELETE', cache: 'no-store' })
    if (!res.ok) throw new Error((await safeJson(res))?.error || 'Unpick failed')
  }

  function resolve(side: { id?: string; abbr?: string | null }) {
    const abbrKey = side?.abbr ? String(side.abbr).toUpperCase() : undefined
    const byId = side?.id ? (teamIndex as any)[side.id] : undefined
    const byAbbr = abbrKey ? (teamIndex as any)[abbrKey] : undefined
    const chosen = byId || byAbbr
    return { team: chosen, teamId: chosen?.id }
  }

  async function togglePick(teamId: string, gameId: string) {
    try {
      const existing = pickByGame.get(gameId)
      if (existing) await deletePickById(existing.id)
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leagueId, season, week, teamId, gameId }),
        cache: 'no-store',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || `HTTP ${res.status}`)
      }
      await refreshMyPicks()
      setMsg('')
    } catch (e: any) {
      const m = e?.message || 'Pick error'
      setMsg(m)
      console.error('togglePick error', m)
    }
  }

  // Invite-join fallback when no leagues
  function extractLeagueId(input: string) {
    const s = input.trim()
    if (!s) return ''
    try {
      const u = new URL(s)
      const q = u.searchParams.get('leagueId')
      if (q) return q
    } catch {
      /* not a URL */
    }
    return s
  }
  async function joinFromInvite() {
    const id = extractLeagueId(invite)
    if (!id) {
      setMsg('Please paste an invite link or league id')
      return
    }
    setJoining(true)
    setMsg('')
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
        <div className="flex items-center gap-2">
          <Image alt="" src="/favicon.ico" width={24} height={24} className="rounded" />
          <h1 className="text-xl font-bold">Make your picks</h1>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <Link className="underline text-sm" href="/standings">Standings</Link>
          <Link className="opacity-80 hover:opacity-100 text-sm underline-offset-4 hover:underline" href="/stats">Stats</Link>

          {/* League label / selector */}
          {noLeagues ? null : singleLeague ? (
            <span className="text-sm text-neutral-600">
              League: <strong>{leagues[0].name}</strong>
            </span>
          ) : (
            <select
              className="border rounded px-2 py-1 bg-transparent"
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
            >
              {leagues.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
            </select>
          )}

          {/* Season & Week */}
          {!noLeagues && (
            <>
              <select
                className="border rounded px-2 py-1 bg-transparent"
                value={season}
                onChange={(e) => {
                  setSeason(Number(e.target.value))
                  setUserPickedWeek(false) // allow auto-week again on season change
                }}
              >
                {Array.from({ length: 3 }).map((_, i) => {
                  const yr = new Date().getFullYear() - 1 + i
                  return (<option key={yr} value={yr}>{yr}</option>)
                })}
              </select>
              <select
                className="border rounded px-2 py-1 bg-transparent"
                value={week}
                onChange={(e) => {
                  setWeek(Number(e.target.value))
                  setUserPickedWeek(true)
                }}
              >
                {Array.from({ length: 18 }).map((_, i) => {
                  const wk = i + 1
                  return (<option key={wk} value={wk}>Week {wk}</option>)
                })}
              </select>
            </>
          )}
        </div>
      </section>

      {/* No-league callout */}
      {noLeagues ? (
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
          <h2 className="text-lg font-semibold mb-2">Join a league</h2>
          <p className="text-sm text-neutral-600 mb-3">Paste your invite link (or league ID) to join.</p>
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
          {/* LEFT 2/3 — Wrinkle + Weekly games */}
          <div className="lg:col-span-8 grid gap-6">
            <SpecialPicksCard leagueId={leagueId} season={season} week={week} teams={teamIndex} />

            <SectionCard title={`Week ${week} — ${picksLeft} of 2 picks left`} right={<span className="text-xs text-neutral-500">{msg}</span>}>
              {loading && <div className="text-sm text-neutral-500">Loading…</div>}
              {!loading && games.length === 0 && <div className="text-sm text-neutral-500">No games.</div>}

              {games.map((g) => {
                const { team: homeTeam, teamId: homeId } = resolve(g.home)
                const { team: awayTeam, teamId: awayId } = resolve(g.away)

                const locked = isLocked(g.game_utc)
                const existing = pickByGame.get(g.id)
                const weeklyQuotaFull = (picks?.length ?? 0) >= 2 && !existing

                return (
                  <article key={g.id} className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
                    <div className="mb-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                      <span>{new Date(g.game_utc).toLocaleString()} • Week {g.week}</span>
                      <span className="uppercase tracking-wide">{locked ? 'LOCKED' : g.status || 'UPCOMING'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <TeamPickButton
                          team={homeTeam}
                          picked={homeId ? picks.some((p) => p.team_id === homeId) : false}
                          disabled={locked || weeklyQuotaFull || !homeId}
                          onClick={() => homeId && togglePick(homeId, g.id)}
                        />
                      </div>
                      <div className="text-neutral-400">—</div>
                      <div className="flex-1">
                        <TeamPickButton
                          team={awayTeam}
                          picked={awayId ? picks.some((p) => p.team_id === awayId) : false}
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

          {/* RIGHT 1/3 — My picks (solid pills) + Season picks (outline pills) */}
          <aside className="lg:col-span-4 grid gap-6">
            <SectionCard title={`My picks — Week ${week}`}>
              {picks.length === 0 ? (
                <div className="text-sm text-neutral-500">No picks yet.</div>
              ) : (
                <ul className="grid gap-2">
                  {picks.map((p) => {
                    const t =
                      (teamIndex as any)[p.team_id] ||
                      (teamIndex as any)[(teamIndex as any)[p.team_id]?.abbreviation?.toUpperCase() || '']
                    const locked = p.game_id ? isLocked(games.find((g) => g.id === p.game_id)?.game_utc) : false
                    return (
                      <li key={p.id} className="flex items-center justify-between">
                        <PickPill team={t} solid />
                        <button
                          className="text-xs underline disabled:opacity-50"
                          disabled={locked}
                          onClick={async () => {
                            try {
                              await deletePickById(p.id)
                              await refreshMyPicks()
                              setMsg('')
                            } catch (e: any) {
                              const m = e?.message || 'Unpick failed'
                              setMsg(m)
                              console.error('unpick error', m)
                            }
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

            <SectionCard title="My picks this season">
              {seasonPicks.length === 0 ? (
                <div className="text-sm text-neutral-500">No season picks yet.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {seasonPicks.map((p) => {
                    const t =
                      (teamIndex as any)[p.team_id] ||
                      (teamIndex as any)[(teamIndex as any)[p.team_id]?.abbreviation?.toUpperCase() || '']
                    return <PickPill key={p.id} team={t} />
                  })}
                </div>
              )}
            </SectionCard>
          </aside>
        </div>
      )}
    </main>
  )
}
