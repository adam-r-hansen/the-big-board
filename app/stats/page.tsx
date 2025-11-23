'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import LeagueMemberStatsTable from '@/components/stats/LeagueMemberStatsTable'
import TeamCard from '@/components/TeamCard'

type League = { id: string; name: string; season: number }

type Team = {
  id: string
  abbreviation: string | null
  name?: string | null
  short_name?: string | null
  color_primary?: string | null
  color_secondary?: string | null
  color_pref_light?: string | null
  color_pref_dark?: string | null
  logo?: string | null
  logo_dark?: string | null
}

type TeamCardTeam = {
  id: string
  name: string
  short_name: string
  abbreviation: string
  logo: string
  color_primary: string
  color_secondary?: string
  color_pref_light?: string | null
  color_pref_dark?: string | null
}

type Member = {
  profile_id: string
  display_name: string
  total_picks: number
  decided_picks: number
  correct_picks: number
  accuracy: number
  points_total: number
  avg_per_pick: number
  longest_streak: number
  current_streak: number
  wrinkle_points: number
  last_5: string[]
}

type MySummary = {
  picks_total: number; decided_picks: number; correct: number; accuracy: number;
  longest_streak: number; points_total: number; avg_points_per_pick: number; wrinkle_points: number
}
type MyLogRow = {
  week: number; team_id: string; game_id: string | null; status: string;
  result: 'W'|'L'|'T'|'—'; score: { home: number|null; away: number|null } | null; points: number | null; wrinkle: boolean
}
type LeagueLogRow = {
  week: number
  profile_id: string
  display_name: string
  preferred_color?: string | null
  team_id: string
  game_id: string | null
  status: string
  result: 'W'|'L'|'T'|'—'
  score: { home: number|null; away: number|null } | null
  points: number | null
  wrinkle: boolean
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

function getTeam(teamId: string, teamMap: Record<string, Team>): TeamCardTeam | null {
  const team = teamMap[teamId] || teamMap[teamId?.toUpperCase()]
  if (!team) return null
  
  return {
    id: team.id || '',
    name: team.name || '',
    short_name: team.short_name || team.name || '',
    abbreviation: team.abbreviation || '',
    logo: team.logo || '',
    color_primary: team.color_primary || '#6b7280',
    color_secondary: team.color_secondary || undefined,
    color_pref_light: team.color_pref_light || undefined,
    color_pref_dark: team.color_pref_dark || undefined,
  }
}

// Helper to convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return `rgba(107, 114, 128, ${alpha})`
  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function StatsPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState<string>('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [includeLive, setIncludeLive] = useState(false)
  
  const [selectedWeek, setSelectedWeek] = useState<number>(1)

  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})

  const [mySummary, setMySummary] = useState<MySummary | null>(null)
  const [myLog, setMyLog] = useState<MyLogRow[]>([])
  
  const [leagueMembers, setLeagueMembers] = useState<Member[]>([])
  
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
      setErr(''); setMySummary(null); setMyLog([]); setLeagueMembers([]); setLeagueLog([])
      try {
        const [a, b, c] = await Promise.all([
          fetch(`/api/my-stats?season=${season}&leagueId=${leagueId}&includeLive=${includeLive?'true':'false'}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/league-stats?leagueId=${leagueId}&season=${season}&includeLive=${includeLive?'true':'false'}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/league-member-stats?leagueId=${leagueId}&season=${season}`, { cache: 'no-store' }).then(r => r.json()),
        ])
        if (!a?.ok) setErr(a?.error || 'Failed to load my stats'); else { setMySummary(a.summary); setMyLog(a.log || []) }
        if (!b?.ok) setErr(prev => prev || b?.error || 'Failed to load league stats'); else { setLeagueLog(b.log || []) }
        if (c?.members) setLeagueMembers(c.members)
      } catch (e: any) { setErr(e?.message || 'Failed to load stats') }
    })()
  }, [season, leagueId, includeLive])

  const seasonOptions = useMemo(() => Array.from({ length: 3 }).map((_, i) => new Date().getFullYear() - 1 + i), [])
  const leagueName = useMemo(() => leagues.find(l => l.id === leagueId)?.name || 'League', [leagues, leagueId])

  // Get available weeks from league log
  const availableWeeks = useMemo(() => {
    const weeks = new Set(leagueLog.map(r => r.week))
    return Array.from(weeks).sort((a, b) => a - b)
  }, [leagueLog])

  // Filter league log by selected week
  const filteredLeagueLog = useMemo(() => {
    if (!selectedWeek) return leagueLog
    return leagueLog.filter(r => r.week === selectedWeek)
  }, [leagueLog, selectedWeek])

  // Group league log by member
  const groupedLeagueLog = useMemo(() => {
    const groups = new Map<string, { 
      profile_id: string
      display_name: string
      preferred_color: string
      picks: LeagueLogRow[]
      total_points: number
    }>()

    for (const row of filteredLeagueLog) {
      const key = row.profile_id
      if (!groups.has(key)) {
        groups.set(key, {
          profile_id: row.profile_id,
          display_name: row.display_name,
          preferred_color: row.preferred_color || '#6b7280',
          picks: [],
          total_points: 0,
        })
      }
      const group = groups.get(key)!
      group.picks.push(row)
      group.total_points += row.points ?? 0
    }

    return Array.from(groups.values()).sort((a, b) => a.display_name.localeCompare(b.display_name))
  }, [filteredLeagueLog])

  // Set initial week when data loads
  useEffect(() => {
    if (availableWeeks.length > 0 && !selectedWeek) {
      setSelectedWeek(availableWeeks[availableWeeks.length - 1]) // Most recent week
    }
  }, [availableWeeks, selectedWeek])

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      {/* Header controls */}
      <section className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Stats</h1>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <select className="border rounded px-2 py-1 bg-transparent" value={season} onChange={e => setSeason(Number(e.target.value))}>
            {seasonOptions.map(yr => <option key={yr} value={yr}>{yr}</option>)}
          </select>
          {leagues.length <= 1 ? (
            <span className="text-sm text-neutral-600 dark:text-neutral-400">League: <strong>{leagueName}</strong></span>
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
        <div className="grid grid-cols-1 gap-6">
          
          {/* League Member Stats Table */}
          <Card title={`League Member Stats — ${leagueName}`}>
            {leagueMembers.length === 0 ? (
              <div className="text-sm text-neutral-500">Loading...</div>
            ) : (
              <LeagueMemberStatsTable members={leagueMembers} />
            )}
          </Card>

          {/* My Season Summary - full width */}
          <Card title={`My Season (${season})`}>
            {!mySummary ? (
              <div className="text-sm text-neutral-500">Loading…</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-xs text-neutral-500 mb-1">Total Picks</div>
                  <div className="text-2xl font-semibold">{mySummary.picks_total}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-neutral-500 mb-1">Correct</div>
                  <div className="text-2xl font-semibold">{mySummary.correct}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-neutral-500 mb-1">Accuracy</div>
                  <div className="text-2xl font-semibold">{(mySummary.accuracy * 100).toFixed(1)}%</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-neutral-500 mb-1">Total Points</div>
                  <div className="text-2xl font-semibold">{mySummary.points_total.toFixed(1)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-neutral-500 mb-1">Avg / Pick</div>
                  <div className="text-2xl font-semibold">{mySummary.avg_points_per_pick.toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-neutral-500 mb-1">Longest Streak</div>
                  <div className="text-2xl font-semibold">{mySummary.longest_streak}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-neutral-500 mb-1">Decided</div>
                  <div className="text-2xl font-semibold">{mySummary.decided_picks}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-neutral-500 mb-1">Wrinkle Points</div>
                  <div className="text-2xl font-semibold">{mySummary.wrinkle_points.toFixed(1)}</div>
                </div>
              </div>
            )}
          </Card>

          {/* NEW LAYOUT: 50/50 My Pick Log + League Pick Log */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* My Pick Log - 50% width */}
            <Card title="My Pick Log" right={<span className="text-xs text-neutral-500 uppercase tracking-wide">{includeLive ? 'Finals + Live' : 'Finals only'}</span>}>
              {myLog.length === 0 ? (
                <div className="text-sm text-neutral-500">No picks yet.</div>
              ) : (
                <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto">
                  {myLog.map((r, idx) => {
                    const team = getTeam(r.team_id, teamMap)
                    if (!team) return null
                    
                    const pointsBg = hexToRgba(team.color_primary, 0.5)
                    const statusColor = r.status === 'FINAL' ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        {/* Week badge */}
                        <div className="min-w-[60px] text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                          Week {r.week}
                        </div>
                        
                        {/* TeamCard with status and points */}
                        <div className="flex-1 relative min-w-0">
                          {r.wrinkle && (
                            <span className="absolute -top-2 -right-2 z-10 bg-purple-600 text-white px-2 py-1 rounded-md text-[11px] font-bold shadow-lg">
                              W
                            </span>
                          )}
                          <div className="relative flex flex-col gap-1">
                            {/* Status badge above */}
                            <div className="flex justify-center">
                              <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
                                {r.status}
                              </span>
                            </div>
                            
                            {/* TeamCard */}
                            <TeamCard
                              team={team}
                              variant="solid"
                              displayText="short"
                              disabled
                              className="w-full"
                            />
                            
                            {/* Points pill below */}
                            <div className="flex justify-center">
                              <span 
                                className="text-xl font-bold text-white px-4 py-2 rounded-full shadow-md"
                                style={{ background: pointsBg }}
                              >
                                {r.points ?? 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* League Pick Log - 50% width */}
            <Card 
              title={`League Pick Log — Week ${selectedWeek}`}
              right={
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-500 uppercase tracking-wide">{includeLive ? 'Finals + Live' : 'Finals only'}</span>
                  <select 
                    className="border rounded px-2 py-1 text-sm bg-transparent" 
                    value={selectedWeek} 
                    onChange={e => setSelectedWeek(Number(e.target.value))}
                  >
                    {availableWeeks.map(wk => (
                      <option key={wk} value={wk}>Week {wk}</option>
                    ))}
                  </select>
                </div>
              }
            >
              {groupedLeagueLog.length === 0 ? (
                <div className="text-sm text-neutral-500">No picks for this week.</div>
              ) : (
                <div className="flex flex-col gap-5 max-h-[600px] overflow-y-auto">
                  {groupedLeagueLog.map((member) => (
                    <div
                      key={member.profile_id}
                      className="rounded-xl p-4"
                      style={{ border: `3px solid ${member.preferred_color}` }}
                    >
                      {/* Member header */}
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-200 dark:border-neutral-700">
                        <span className="font-semibold text-base">{member.display_name}</span>
                        <span className="font-semibold text-base text-neutral-600 dark:text-neutral-400">{member.total_points} pts</span>
                      </div>
                      
                      {/* Member's picks */}
                      <div className="flex flex-col gap-3">
                        {member.picks.map((pick, pickIdx) => {
                          const team = getTeam(pick.team_id, teamMap)
                          if (!team) return null
                          
                          const pointsBg = hexToRgba(team.color_primary, 0.5)
                          const gameScore = pick.score ? `${pick.score.away ?? '—'} - ${pick.score.home ?? '—'}` : ''
                          const statusColor = pick.status === 'FINAL' ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          
                          return (
                            <div key={pickIdx} className="relative">
                              {pick.wrinkle && (
                                <span className="absolute -top-2 -right-2 z-10 bg-purple-600 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-md">
                                  W
                                </span>
                              )}
                              
                              <div className="flex flex-col gap-1">
                                {/* Game score */}
                                {gameScore && (
                                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 text-center">
                                    {gameScore}
                                  </div>
                                )}
                                
                                {/* Status badge above */}
                                <div className="flex justify-center">
                                  <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
                                    {pick.status}
                                  </span>
                                </div>
                                
                                {/* TeamCard */}
                                <TeamCard
                                  team={team}
                                  variant="solid"
                                  displayText="short"
                                  disabled
                                  className="w-full"
                                />
                                
                                {/* Points pill below */}
                                <div className="flex justify-center">
                                  <span 
                                    className="text-lg font-bold text-white px-4 py-1.5 rounded-full shadow-md"
                                    style={{ background: pointsBg }}
                                  >
                                    {pick.points ?? 0}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </main>
  )
}
