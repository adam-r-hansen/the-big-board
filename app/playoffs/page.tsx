// app/playoffs/page.tsx
'use client'
import { useEffect, useState, useMemo } from 'react'
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
type Game = { 
  id: string
  season: number
  week: number
  game_utc: string
  status?: string
  home: { id?: string; abbr?: string | null }
  away: { id?: string; abbr?: string | null }
}
type PlayoffRound = {
  id: string
  league_id: string
  week_number: number
  round_type: 'semifinal' | 'championship' | 'consolation'
  status: 'pending' | 'active' | 'complete'
}
type PlayoffPick = {
  id: string
  game_id: string
  team_id: string
  pick_position: number
  unlock_time: string
  picked_at: string | null
  last_changed_at: string | null
}
type PlayoffStanding = {
  league_membership_id: string
  rank: number
  total_score: number
  seed: number
}

export default function PlayoffsPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [membershipId, setMembershipId] = useState<string>('')
  
  const [rounds, setRounds] = useState<PlayoffRound[]>([])
  const [activeRound, setActiveRound] = useState<PlayoffRound | null>(null)
  const [standings, setStandings] = useState<PlayoffStanding[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [picks, setPicks] = useState<PlayoffPick[]>([])
  const [otherPicks, setOtherPicks] = useState<Array<{ game_id: string; team_id: string }>>([])
  const [allPlayoffPicks, setAllPlayoffPicks] = useState<any[]>([])
  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})
  
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string>('')
  const [now, setNow] = useState(new Date())

  // Update time every minute for countdowns
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

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

  // Load leagues
  useEffect(() => {
    ;(async () => {
      try {
        const j = await fetch('/api/my-leagues', { cache: 'no-store' }).then(r => r.json())
        const ls: League[] = j.leagues || []
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
    })()
    
    fetch('/api/team-map').then(r => r.json()).then(j => setTeamMap(j.teams || {})).catch(() => {})
  }, [])

  // Get membership ID
  useEffect(() => {
    if (!leagueId) return
    
    ;(async () => {
      try {
        const res = await fetch(`/api/my-leagues`, { cache: 'no-store' }).then(r => r.json())
        // We'll need to get membership ID from league_memberships
        // For now, we'll get it when we fetch picks
      } catch {}
    })()
  }, [leagueId])

  // Load playoff rounds
  useEffect(() => {
    if (!leagueId) return
    
    ;(async () => {
      try {
        const r = await fetch(`/api/playoffs/rounds?leagueId=${leagueId}`, { cache: 'no-store' }).then(r => r.json())
        const roundsList: PlayoffRound[] = r.rounds || []
        setRounds(roundsList)
        
        const active = roundsList.find(rd => rd.status === 'active')
        setActiveRound(active || null)
      } catch (e: any) {
        setMsg(e?.message || 'Failed to load playoff rounds')
      }
    })()
  }, [leagueId])

  // Load standings, games, and picks for active round
  useEffect(() => {
    if (!activeRound || !leagueId) return
    
    setLoading(true)
    ;(async () => {
      try {
        const [standingsRes, gamesRes, picksRes] = await Promise.all([
          fetch(`/api/playoffs/standings?roundId=${activeRound.id}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/games-for-week?season=${season}&week=${activeRound.week_number}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/playoffs/picks?leagueId=${leagueId}&roundId=${activeRound.id}`, { cache: 'no-store' }).then(r => r.json())
        ])
        
        setStandings(standingsRes.standings || [])
        
        const gamesList: Game[] = (gamesRes.games || gamesRes || []).map((x: any) => ({
          id: x.id,
          season: x.season,
          week: x.week,
          game_utc: x.game_utc || x.start_time,
          status: x.status ?? 'UPCOMING',
          home: {
            id: x.home?.id ?? x.home_team ?? x.homeTeamId,
            abbr: x.home?.abbreviation ?? x.home_abbr ?? null,
          },
          away: {
            id: x.away?.id ?? x.away_team ?? x.awayTeamId,
            abbr: x.away?.abbreviation ?? x.away_abbr ?? null,
          },
        }))
        
        setGames(gamesList)
        setPicks(picksRes.userPicks || [])
        setOtherPicks(picksRes.otherPicks || [])
        
        // Store all picks for showing in team columns
        setAllPlayoffPicks([...(picksRes.userPicks || []), ...(picksRes.otherPicks || [])])
        
        if (picksRes.userPicks && picksRes.userPicks[0]) {
          setMembershipId(picksRes.userPicks[0].league_membership_id)
        }
        
        setMsg('')
      } catch (e: any) {
        setMsg(e?.message || 'Failed to load playoff data')
      } finally {
        setLoading(false)
      }
    })()
  }, [activeRound, leagueId, season])

  // Find user's seed
  const userSeed = useMemo(() => {
    if (!membershipId || standings.length === 0) return null
    const standing = standings.find(s => s.league_membership_id === membershipId)
    return standing?.seed || null
  }, [standings, membershipId])

  // Check if team/game is available
  const isTeamAvailable = (teamId: string, gameId: string) => {
    if (otherPicks.some(p => p.team_id === teamId)) return false
    
    const game = games.find(g => g.id === gameId)
    if (!game) return false
    
    const gameTime = game.game_utc ? new Date(game.game_utc) : null
    if (gameTime && gameTime <= new Date()) return false
    if (game.status?.toUpperCase() === 'FINAL') return false
    
    return true
  }

  // Check if unlock window has passed
  const isUnlocked = (pickPosition: number) => {
    const pick = picks.find(p => p.pick_position === pickPosition)
    if (!pick) return false
    
    const unlockTime = new Date(pick.unlock_time)
    return new Date() >= unlockTime
  }

  // Get countdown for next unlock
  const getNextUnlock = () => {
    const futurePicks = picks.filter(p => {
      const unlockTime = new Date(p.unlock_time)
      return unlockTime > now && !p.picked_at
    })
    
    if (futurePicks.length === 0) return null
    
    futurePicks.sort((a, b) => new Date(a.unlock_time).getTime() - new Date(b.unlock_time).getTime())
    return futurePicks[0]
  }

  const formatCountdown = (unlockTime: Date) => {
    const diff = unlockTime.getTime() - now.getTime()
    if (diff <= 0) return 'Unlocked'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}d ${hours % 24}h`
    }
    return `${hours}h ${minutes}m`
  }

  // Handle pick selection
  const handlePickTeam = async (gameId: string, teamId: string, pickPosition: number) => {
    if (!activeRound) return
    if (!isUnlocked(pickPosition)) {
      setMsg('This pick slot is not unlocked yet')
      setTimeout(() => setMsg(''), 3000)
      return
    }
    if (!isTeamAvailable(teamId, gameId)) {
      setMsg('This team is no longer available')
      setTimeout(() => setMsg(''), 3000)
      return
    }
    
    setLoading(true)
    try {
      const res = await fetch('/api/playoffs/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: activeRound.id,
          gameId,
          teamId,
          pickPosition
        })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setMsg(data.error || 'Failed to make pick')
        setTimeout(() => setMsg(''), 3000)
        return
      }
      
      // Refresh data
      const [standingsRes, picksRes] = await Promise.all([
        fetch(`/api/playoffs/standings?roundId=${activeRound.id}`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/playoffs/picks?leagueId=${leagueId}&roundId=${activeRound.id}`, { cache: 'no-store' }).then(r => r.json())
      ])
      
      setStandings(standingsRes.standings || [])
      setPicks(picksRes.userPicks || [])
      setOtherPicks(picksRes.otherPicks || [])
      setAllPlayoffPicks([...(picksRes.userPicks || []), ...(picksRes.otherPicks || [])])
      
      setMsg('Pick saved!')
      setTimeout(() => setMsg(''), 2000)
    } catch (e: any) {
      setMsg(e?.message || 'Failed to save pick')
      setTimeout(() => setMsg(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  const singleLeague = leagues.length === 1

  if (!activeRound) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-6 flex items-center justify-between pb-5 border-b-2 border-neutral-300 dark:border-neutral-700">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-yellow-400 bg-clip-text text-transparent flex items-center gap-3">
            <span className="text-3xl">🏆</span> PLAYOFFS
          </h1>
          <div className="flex gap-3">
            <Link href="/" className="text-sm underline">Home</Link>
            <Link href="/picks" className="text-sm underline">Picks</Link>
            <Link href="/standings" className="text-sm underline">Standings</Link>
          </div>
        </header>
        
        {!singleLeague && leagues.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">League</label>
            <select 
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2"
              value={leagueId}
              onChange={(e) => {
                const lid = e.target.value
                setLeagueId(lid)
                const league = leagues.find(l => l.id === lid)
                if (league) setSeason(league.season)
              }}
            >
              {leagues.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        )}
        
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
          <p className="text-neutral-600 dark:text-neutral-400">
            Playoffs have not started yet. Check back during playoff weeks (17-18).
          </p>
        </div>
      </main>
    )
  }

  const roundTitle = activeRound.round_type === 'semifinal' 
    ? 'SEMIFINALS'
    : activeRound.round_type === 'championship'
    ? 'CHAMPIONSHIP'
    : 'CONSOLATION'

  const nextUnlock = getNextUnlock()
  const userStanding = standings.find(s => s.league_membership_id === membershipId)
  const picksMade = picks.filter(p => p.picked_at).length

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between pb-5 border-b-2" style={{ borderColor: 'rgba(212, 175, 55, 0.3)' }}>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-yellow-400 bg-clip-text text-transparent flex items-center gap-3">
          <span className="text-4xl">🏆</span> PLAYOFFS - {roundTitle}
        </h1>
        <div className="flex gap-3 text-sm">
          <Link href="/" className="hover:text-yellow-600 transition-colors">Home</Link>
          <Link href="/picks" className="hover:text-yellow-600 transition-colors">Picks</Link>
          <Link href="/standings" className="hover:text-yellow-600 transition-colors">Standings</Link>
        </div>
      </header>

      {msg && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 px-4 py-3 text-sm">
          {msg}
        </div>
      )}

      {/* Playoff Teams Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {standings.sort((a, b) => a.seed - b.seed).map((standing) => {
          const isYou = standing.league_membership_id === membershipId
          const seedPicks = picks.filter(p => true) // All user picks or could filter by seed
          
          return (
            <div 
              key={standing.league_membership_id}
              className={`rounded-2xl border-2 p-4 transition-all ${
                isYou 
                  ? 'border-yellow-600 shadow-lg shadow-yellow-600/20' 
                  : 'border-neutral-300 dark:border-neutral-700'
              }`}
              style={isYou ? { 
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.05) 0%, rgba(212, 175, 55, 0.02) 100%)'
              } : {}}
            >
              <div className="inline-block bg-gradient-to-r from-yellow-600 to-yellow-400 text-white text-xs font-bold px-3 py-1 rounded-full mb-2">
                SEED #{standing.seed}
              </div>
              <div className="font-semibold mb-3 text-yellow-600">
                {isYou ? '🔥 YOU' : `Player ${standing.seed}`}
              </div>
              <div className="space-y-2">
                {[1, 2, 3, 4].map(pos => {
                  const pick = isYou ? picks.find(p => p.pick_position === pos) : null
                  const unlocked = isYou ? isUnlocked(pos) : false
                  const filled = pick?.picked_at
                  
                  return (
                    <div 
                      key={pos}
                      className={`h-10 rounded-lg border-2 flex items-center justify-center text-xs ${
                        filled 
                          ? 'border-yellow-600 bg-yellow-600/10 text-yellow-600 font-semibold' 
                          : unlocked
                          ? 'border-dashed border-neutral-400 dark:border-neutral-600 text-neutral-500'
                          : 'border-neutral-300 dark:border-neutral-700 text-neutral-400 text-[10px]'
                      }`}
                    >
                      {filled && pick?.team_id 
                        ? `Pick ${pos}: ${teamIndex[pick.team_id]?.abbreviation || '?'}`
                        : unlocked
                        ? `Pick ${pos}`
                        : pick
                        ? `🔒 ${new Date(pick.unlock_time).toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric' })}`
                        : `Pick ${pos}`
                      }
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Main Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Games Section (2/3) */}
        <div className="md:col-span-2">
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>🏈</span> Week {activeRound.week_number} Games
            </h2>
            
            <div className="space-y-3">
              {games.map(game => {
                const homeAvailable = game.home.id ? isTeamAvailable(game.home.id, game.id) : false
                const awayAvailable = game.away.id ? isTeamAvailable(game.away.id, game.id) : false
                const homePicked = picks.some(p => p.team_id === game.home.id && p.picked_at)
                const awayPicked = picks.some(p => p.team_id === game.away.id && p.picked_at)
                
                // Find which position this pick is in
                const homePickPos = picks.find(p => p.team_id === game.home.id)?.pick_position
                const awayPickPos = picks.find(p => p.team_id === game.away.id)?.pick_position
                
                const currentUnlockedPos = picks.find(p => !p.picked_at && isUnlocked(p.pick_position))?.pick_position
                
                return (
                  <div key={game.id} className="grid grid-cols-2 gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl">
                    <button
                      onClick={() => {
                        if (currentUnlockedPos && game.home.id) {
                          handlePickTeam(game.id, game.home.id, currentUnlockedPos)
                        }
                      }}
                      disabled={!homeAvailable && !homePicked}
                      className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                        homePicked
                          ? 'border-yellow-600 bg-yellow-600/10 text-yellow-600 shadow-inner'
                          : homeAvailable && currentUnlockedPos
                          ? 'border-neutral-300 dark:border-neutral-600 hover:border-yellow-600 hover:bg-yellow-600/5 cursor-pointer'
                          : 'border-neutral-200 dark:border-neutral-700 opacity-30 cursor-not-allowed'
                      }`}
                    >
                      {game.home.abbr || '?'}
                      {homePicked && homePickPos && <span className="block text-[10px] mt-1">Pick #{homePickPos}</span>}
                    </button>
                    
                    <button
                      onClick={() => {
                        if (currentUnlockedPos && game.away.id) {
                          handlePickTeam(game.id, game.away.id, currentUnlockedPos)
                        }
                      }}
                      disabled={!awayAvailable && !awayPicked}
                      className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                        awayPicked
                          ? 'border-yellow-600 bg-yellow-600/10 text-yellow-600 shadow-inner'
                          : awayAvailable && currentUnlockedPos
                          ? 'border-neutral-300 dark:border-neutral-600 hover:border-yellow-600 hover:bg-yellow-600/5 cursor-pointer'
                          : 'border-neutral-200 dark:border-neutral-700 opacity-30 cursor-not-allowed'
                      }`}
                    >
                      {game.away.abbr || '?'}
                      {awayPicked && awayPickPos && <span className="block text-[10px] mt-1">Pick #{awayPickPos}</span>}
                    </button>
                  </div>
                )
              })}
            </div>
            
            <div className="mt-4 p-3 bg-yellow-600/5 border border-yellow-600/20 rounded-lg text-xs text-neutral-600 dark:text-neutral-400">
              <strong>Legend:</strong> Available = Click to pick | Taken = Picked by another playoff team | Locked = Game started
            </div>
          </div>
        </div>

        {/* Sidebar (1/3) */}
        <div className="space-y-4">
          {/* Next Unlock */}
          {nextUnlock && (
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <span>⏰</span> Next Unlock
              </h3>
              <div className="bg-gradient-to-r from-yellow-600 to-yellow-400 text-white rounded-xl p-4 text-center">
                <div className="text-xs opacity-80 mb-1">YOUR PICK #{nextUnlock.pick_position}</div>
                <div className="text-2xl font-bold my-2">
                  {formatCountdown(new Date(nextUnlock.unlock_time))}
                </div>
                <div className="text-xs opacity-80">
                  {new Date(nextUnlock.unlock_time).toLocaleString([], { 
                    weekday: 'short',
                    month: 'short', 
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Your Status */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span>📊</span> Your Status
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">Seed</span>
                <span className="font-semibold text-yellow-600">#{userSeed}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">Picks Made</span>
                <span className="font-semibold text-yellow-600">{picksMade} / 4</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">Current Score</span>
                <span className="font-semibold text-yellow-600">{userStanding?.total_score || 0} pts</span>
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span>🏆</span> Live Standings
            </h3>
            <div className="space-y-2">
              {standings.sort((a, b) => a.rank - b.rank).map((s) => {
                const isYou = s.league_membership_id === membershipId
                return (
                  <div 
                    key={s.league_membership_id}
                    className={`flex justify-between text-sm py-2 px-3 rounded-lg ${
                      isYou ? 'bg-yellow-600/10 font-semibold' : ''
                    }`}
                  >
                    <span>{s.rank}. {isYou ? 'You' : `Player ${s.seed}`}</span>
                    <span className={isYou ? 'text-yellow-600' : ''}>{s.total_score} pts</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
