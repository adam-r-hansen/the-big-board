'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

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

type MySummary = {
  picks_total: number; decided_picks: number; correct: number; accuracy: number;
  longest_streak: number; points_total: number; avg_points_per_pick: number; wrinkle_points: number
}
type MyLogRow = {
  week: number; team_id: string; game_id: string | null; status: string;
  result: 'W'|'L'|'T'|'—'; score: { home: number|null; away: number|null } | null; points: number | null; wrinkle: boolean
}
type LeagueLeaders = {
  avg_points_per_pick: Array<{ profile_id: string; display_name: string; decided: number; points_total: number; avg_points_per_pick: number }>
  accuracy: Array<{ profile_id: string; display_name: string; correct: number; decided: number; accuracy: number }>
  longest_streak: Array<{ profile_id: string; display_name: string; longest_streak: number }>
}
type LeagueLogRow = {
  week: number; profile_id: string; display_name: string; team_id: string; game_id: string | null;
  status: string; result: 'W'|'L'|'T'|'—'; score: { home: number|null; away: number|null } | null; points: number | null; wrinkle: boolean
}

function Card(props: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{props.title}</h2>
        {props.right}
      </header>
      {props.children}
    </section>
  )
}

// --- Chip + team index (same look & feel as Home) ---
function Chip({
  label,
  primary = '#6b7280',
  secondary = '#374151',
  subtle = false,
  badge,
  title,
  className = '',
}: {
  label: React.ReactNode
  primary?: string
  secondary?: string
  subtle?: boolean
  badge?: React.ReactNode
  title?: string
  className?: string
}) {
  return (
    <span
      title={title}
      className={[
        'inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold',
        'overflow-hidden text-ellipsis whitespace-nowrap',
        subtle ? 'opacity-80' : '',
        className,
      ].join(' ')}
      style={{
        borderColor: primary,
        color: primary,
        background: subtle ? `linear-gradient(0deg, ${secondary}10, transparent)` : 'transparent',
      }}
    >
      {label}
      {badge ? <span className="text-xs font-normal">{badge}</span> : null}
    </span>
  )
}

function useTeamIndex(teamMap: Record<string, Team>) {
  return useMemo(() => {
    const idx: Record<string, TeamLike> = {}
    for (const t of Object.values(teamMap || {})) {
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
}

export default function StatsPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState<string>('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [includeLive, setIncludeLive] = useState(false)

  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})
  const teamIndex = useTeamIndex(teamMap)

  const [mySummary, setMySummary] = useState<MySummary | null>(null)
  const [myLog, setMyLog] = useState<MyLogRow[]>([])
  const [leaders, setLeaders] = useState<LeagueLeaders | null>(null)
  const [leagueLog, setLeagueLog] = useState<LeagueLogRow[]>([])
  const [err, setErr] = useState<string>('')

  // Load leagues & team map
  useEffect(() => {
    ;(async () => {
      try {
        const j = await fetch('/api/my-leagues', { cache: 'no-store' }).then(r => r.json())
        const ls: League[] = j?.leagues || []
        setLeagues(ls)
        if (ls.length === 1) {
          setLeagueId(ls[0].id)
          setSeason(ls[0].season)
        } else if (!leagueId && ls[0]) {
          setLeagueId(ls[0].id)
          setSeason(ls[0].season)
        }
      } catch {}
      try {
        const tm = await fetch('/api/team-map', { cache: 'no-store' }).then(r => r.json())
        setTeamMap(tm?.teams || {})
      } catch {}
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load stats when filters change
  useEffect(() => {
    if (!season || !leagueId) return
    ;(async () => {
      setErr(''); setMySummary(null); setMyLog([]); setLeaders(null); setLeagueLog([])
      try {
        const [a, b] = await Promise.all([
          fetch(`/api/my-stats?season=${season}&leagueId=${leagueId}&includeLive=${includeLive?'true':'false'}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/league-stats?leagueId=${leagueId}&season=${season}&includeLive=${includeLive?'true':'false'}`, { cache: 'no-store' }).then(r => r.json()),
        ])
        if (!a?.ok) setErr(a?.error || 'Failed to load my stats'); else { setMySummary(a.summary); setMyLog(a.log || []) }
        if (!b?.ok) setErr(prev => prev || b?.error || 'Failed to load league stats'); else { setLeaders(b.leaders || null); setLeagueLog(b.log || []) }
      } catch (e: any) { setErr(e?.message || 'Failed to load stats') }
    })()
  }, [season, leagueId, includeLive])

  const seasonOptions = useMemo(() => Array.from({ length: 3 }).map((_, i) => new Date().getFullYear() - 1 + i), [])
  const leagueName = useMemo(() => leagues.find(l => l.id === leagueId)?.name || 'League', [leagues, leagueId])

  function teamChipForId(teamId?: string) {
    if (!teamId) return <Chip label="—" />
    const t = teamIndex[teamId]
    const label = t?.abbreviation || '—'
    const primary = t?.color_primary || '#6b7280'
    const secondary = t?.color_secondary || '#374151'
    return <Chip label={label} primary={primary} secondary={secondary} subtle />
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      {/* Header controls – top nav already exists, so no local nav links */}
      <section className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Stats</h1>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <select className="border rounded px-2 py-1 bg-transparent" value={season} onChange={e => setSeason(Number(e.target.value))}>
            {seasonOptions.map(yr => <option key={yr} value={yr}>{yr}</option>)}
          </select>
          {leagues.length <= 1 ? (
            <span className="text-sm text-neutral-600">League: <strong>{leagueName}</strong></span>
          ) : (
            <select className="border rounded px-2 py-1 bg-transparent" value={leagueId} onChange={e => setLeagueId(e.target.value)}>
              {leagues.map(l => <option key={l.id} value={l.id}>{l.name} · {l.season}</option>)}
            </select>
          )}
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeLive} onChange={e => setIncludeLive(e.target.checked)} />
            Include LIVE
          </label>
        </div>
      </section>

      {err && <Card title="Error"><div className="text-sm text-red-600">{err}</div></Card>}

      {!err && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: My stats */}
          <div className="lg:col-span-5 grid gap-6">
            <Card title={`My Season (${season})`}>
              {!mySummary ? <div className="text-sm text-neutral-500">Loading…</div> : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Picks', v: mySummary.picks_total },
                      { label: 'Correct', v: mySummary.correct },
                      { label: 'Win %', v: (mySummary.accuracy * 100).toFixed(1) + '%' },
                      { label: 'Longest Streak', v: mySummary.longest_streak },
                      { label: 'Points', v: mySummary.points_total },
                      { label: 'Avg / Pick', v: mySummary.avg_points_per_pick.toFixed(2) },
                      { label: 'Wrinkle Points', v: mySummary.wrinkle_points },
                    ].map(c => (
                      <div key={c.label} className="rounded-xl border px-4 py-3">
                        <div className="text-xs text-neutral-500">{c.label}</div>
                        <div className="text-2xl font-semibold">{c.v as any}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <h3 className="text-sm font-semibold mb-2">My Pick Log</h3>
                    {myLog.length === 0 ? (
                      <div className="text-sm text-neutral-500">No picks yet.</div>
                    ) : (
                      <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
                        <table className="min-w-full text-sm">
                          <thead className="text-left text-neutral-500 sticky top-0 bg-white/90 dark:bg-neutral-900/90 backdrop-blur">
                            <tr>
                              <th className="py-2 pr-3">Week</th>
                              <th className="py-2 pr-3">Team</th>
                              <th className="py-2 pr-3">Result</th>
                              <th className="py-2 pr-3">Score</th>
                              <th className="py-2 pr-3">Points</th>
                              <th className="py-2 pr-0">Wrinkle</th>
                            </tr>
                          </thead>
                          <tbody>
                            {myLog.map((r, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="py-2 pr-3">{r.week}</td>
                                <td className="py-2 pr-3">{teamChipForId(r.team_id)}</td>
                                <td className="py-2 pr-3">{r.result}</td>
                                <td className="py-2 pr-3">{r.score ? `${r.score.home ?? '–'}-${r.score.away ?? '–'}` : '—'}</td>
                                <td className="py-2 pr-3">{r.points ?? '—'}</td>
                                <td className="py-2 pr-0">{r.wrinkle ? '✓' : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </Card>
          </div>

          {/* RIGHT: League stats */}
          <div className="lg:col-span-7 grid gap-6">
            <Card title="Leaderboard — Avg Points / Pick" right={<span className="text-xs text-neutral-500">Finals only</span>}>
              {!leaders ? <div className="text-sm text-neutral-500">Loading…</div> :
               leaders.avg_points_per_pick.length === 0 ? <div className="text-sm text-neutral-500">No data yet.</div> :
               <div className="overflow-x-auto">
                 <table className="min-w-full text-sm">
                   <thead className="text-left text-neutral-500">
                     <tr>
                       <th className="py-2 pr-3">#</th>
                       <th className="py-2 pr-3">Member</th>
                       <th className="py-2 pr-3">Decided</th>
                       <th className="py-2 pr-3">Points</th>
                       <th className="py-2 pr-0">Avg/Pick</th>
                     </tr>
                   </thead>
                   <tbody>
                     {leaders.avg_points_per_pick.map((r, i) => (
                       <tr key={r.profile_id} className="border-t">
                         <td className="py-2 pr-3">{i + 1}</td>
                         <td className="py-2 pr-3">{r.display_name}</td>
                         <td className="py-2 pr-3">{r.decided}</td>
                         <td className="py-2 pr-3">{r.points_total}</td>
                         <td className="py-2 pr-0">{r.avg_points_per_pick.toFixed(2)}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>}
            </Card>

            <Card title="Leaderboard — Pick Accuracy" right={<span className="text-xs text-neutral-500">Finals only</span>}>
              {!leaders ? <div className="text-sm text-neutral-500">Loading…</div> :
               leaders.accuracy.length === 0 ? <div className="text-sm text-neutral-500">No data yet.</div> :
               <div className="overflow-x-auto">
                 <table className="min-w-full text-sm">
                   <thead className="text-left text-neutral-500">
                     <tr>
                       <th className="py-2 pr-3">#</th>
                       <th className="py-2 pr-3">Member</th>
                       <th className="py-2 pr-3">Correct</th>
                       <th className="py-2 pr-3">Decided</th>
                       <th className="py-2 pr-0">Accuracy</th>
                     </tr>
                   </thead>
                   <tbody>
                     {leaders.accuracy.map((r, i) => (
                       <tr key={r.profile_id} className="border-t">
                         <td className="py-2 pr-3">{i + 1}</td>
                         <td className="py-2 pr-3">{r.display_name}</td>
                         <td className="py-2 pr-3">{r.correct}</td>
                         <td className="py-2 pr-3">{r.decided}</td>
                         <td className="py-2 pr-0">{(r.accuracy * 100).toFixed(1)}%</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>}
            </Card>

            <Card title="Leaderboard — Longest Streak" right={<span className="text-xs text-neutral-500">Finals only</span>}>
              {!leaders ? <div className="text-sm text-neutral-500">Loading…</div> :
               leaders.longest_streak.length === 0 ? <div className="text-sm text-neutral-500">No data yet.</div> :
               <div className="overflow-x-auto">
                 <table className="min-w-full text-sm">
                   <thead className="text-left text-neutral-500">
                     <tr>
                       <th className="py-2 pr-3">#</th>
                       <th className="py-2 pr-3">Member</th>
                       <th className="py-2 pr-0">Longest Streak</th>
                     </tr>
                   </thead>
                   <tbody>
                     {leaders.longest_streak.map((r, i) => (
                       <tr key={r.profile_id} className="border-t">
                         <td className="py-2 pr-3">{i + 1}</td>
                         <td className="py-2 pr-3">{r.display_name}</td>
                         <td className="py-2 pr-0">{r.longest_streak}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>}
            </Card>

            <Card title="League Pick Log" right={<span className="text-xs text-neutral-500">{includeLive ? 'Finals + Live' : 'Finals only'}</span>}>
              {leagueLog.length === 0 ? <div className="text-sm text-neutral-500">No picks yet.</div> : (
                <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-neutral-500 sticky top-0 bg-white/90 dark:bg-neutral-900/90 backdrop-blur">
                      <tr>
                        <th className="py-2 pr-3">Week</th>
                        <th className="py-2 pr-3">Member</th>
                        <th className="py-2 pr-3">Team</th>
                        <th className="py-2 pr-3">Result</th>
                        <th className="py-2 pr-3">Score</th>
                        <th className="py-2 pr-3">Points</th>
                        <th className="py-2 pr-0">Wrinkle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leagueLog.map((r, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="py-2 pr-3">{r.week}</td>
                          <td className="py-2 pr-3">{r.display_name}</td>
                          <td className="py-2 pr-3">{teamChipForId(r.team_id)}</td>
                          <td className="py-2 pr-3">{r.result}</td>
                          <td className="py-2 pr-3">{r.score ? `${r.score.home ?? '–'}-${r.score.away ?? '–'}` : '—'}</td>
                          <td className="py-2 pr-3">{r.points ?? '—'}</td>
                          <td className="py-2 pr-0">{r.wrinkle ? '✓' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </main>
  )
}
