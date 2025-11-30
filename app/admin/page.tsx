'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type League = {
  id: string
  name: string
  season: number
  created_at: string
}

type WrinkleKind = 'bonus_game' | 'bonus_game_ats' | 'bonus_game_oof' | 'winless_double'

type Game = {
  id: string
  game_utc: string
  home: { id: string; abbr?: string }
  away: { id: string; abbr?: string }
}

type Team = { id: string; name: string; abbreviation: string }

type Wrinkle = {
  id: string
  name: string
  kind: WrinkleKind
  week: number
  status: string
  extra_picks: number
}

const WRINKLE_TYPES: { value: WrinkleKind; label: string; description: string }[] = [
  { value: 'bonus_game', label: 'Bonus Pick', description: 'Extra game pick that doesn\'t count toward season total' },
  { value: 'bonus_game_ats', label: 'Bonus Pick (Against the Spread)', description: 'Extra pick where the point spread must be covered' },
  { value: 'bonus_game_oof', label: 'OOF Bonus Pick', description: 'Extra pick from teams with win percentage below .400' },
  { value: 'winless_double', label: 'Winless Double', description: 'Regular picks of winless teams are worth 2x points if they win' },
]

export default function AdminPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [selectedLeagueId, setSelectedLeagueId] = useState('')
  const [name, setName] = useState('')
  const [season, setSeason] = useState(new Date().getFullYear())
  const [msg, setMsg] = useState('')
  const [busyCreate, setBusyCreate] = useState(false)
  const [joinInput, setJoinInput] = useState('')
  const [joinMsg, setJoinMsg] = useState('')
  const [busyJoin, setBusyJoin] = useState(false)

  // Wrinkles state
  const [wrinkleWeek, setWrinkleWeek] = useState(1)
  const [wrinkleSeason, setWrinkleSeason] = useState(new Date().getFullYear())
  const [wrinkleKind, setWrinkleKind] = useState<WrinkleKind>('bonus_game')
  const [wrinkleName, setWrinkleName] = useState('Bonus Pick')
  const [wrinkleStatus, setWrinkleStatus] = useState<'active' | 'paused'>('active')
  const [wrinkleGameId, setWrinkleGameId] = useState('')
  const [wrinkleSpread, setWrinkleSpread] = useState('')
  const [games, setGames] = useState<Game[]>([])
  const [teams, setTeams] = useState<Record<string, Team>>({})
  const [wrinkles, setWrinkles] = useState<Wrinkle[]>([])
  const [creatingWrinkle, setCreatingWrinkle] = useState(false)
  const [wrinkleMsg, setWrinkleMsg] = useState('')

  // Team Records state
  const [recordsWeek, setRecordsWeek] = useState(1)
  const [recordsSeason, setRecordsSeason] = useState(new Date().getFullYear())
  const [refreshingRecords, setRefreshingRecords] = useState(false)
  const [recordsMsg, setRecordsMsg] = useState('')

  // Auto-Assign Picks state
  const [autoAssignWeek, setAutoAssignWeek] = useState(1)
  const [autoAssignSeason, setAutoAssignSeason] = useState(new Date().getFullYear())
  const [autoAssigning, setAutoAssigning] = useState(false)
  const [autoAssignMsg, setAutoAssignMsg] = useState('')

  useEffect(() => {
    loadLeagues()
    loadTeams()
  }, [])

  // Load games when wrinkle week changes
  useEffect(() => {
    if (wrinkleSeason && wrinkleWeek) {
      loadGames()
    }
  }, [wrinkleSeason, wrinkleWeek])

  // Load wrinkles when league/season/week changes
  useEffect(() => {
    if (selectedLeagueId && wrinkleSeason && wrinkleWeek) {
      loadWrinkles()
    }
  }, [selectedLeagueId, wrinkleSeason, wrinkleWeek])

  // Update wrinkle name when kind changes
  useEffect(() => {
    const selected = WRINKLE_TYPES.find(t => t.value === wrinkleKind)
    if (selected) setWrinkleName(selected.label)
  }, [wrinkleKind])

  async function loadLeagues() {
    try {
      const res = await fetch('/api/my-leagues', { cache: 'no-store' })
      const j = await res.json()
      if (res.ok) {
        setLeagues(j.leagues || [])
      }
    } catch (err: any) {
      console.error('Failed to load leagues:', err)
    }
  }

  async function loadTeams() {
    try {
      const res = await fetch('/api/team-map')
      const j = await res.json()
      setTeams(j.teams || {})
    } catch {}
  }

  async function loadGames() {
    try {
      const res = await fetch(`/api/games-for-week?season=${wrinkleSeason}&week=${wrinkleWeek}`)
      const j = await res.json()
      const gs: any[] = j.games ?? []
      setGames(gs.map((x) => ({
        id: x.id,
        game_utc: x.game_utc || x.start_time,
        home: { id: x.home?.id || x.home_team, abbr: x.home?.abbreviation },
        away: { id: x.away?.id || x.away_team, abbr: x.away?.abbreviation },
      })))
    } catch {}
  }

  async function loadWrinkles() {
    try {
      const res = await fetch(`/api/admin/wrinkles?leagueId=${selectedLeagueId}&season=${wrinkleSeason}&week=${wrinkleWeek}`)
      const j = await res.json()
      setWrinkles(j.wrinkles || [])
    } catch {}
  }

  async function createLeague(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    setBusyCreate(true)
    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, season }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Create failed')
      setMsg('League created! ✅')
      setName('')
      await loadLeagues()
    } catch (err: any) {
      setMsg(err?.message || 'Create failed')
    } finally {
      setBusyCreate(false)
    }
  }

  async function joinExisting(e: React.FormEvent) {
    e.preventDefault()
    setJoinMsg('')
    setBusyJoin(true)
    try {
      let leagueId = joinInput.trim()
      if (joinInput.includes('/join?leagueId=')) {
        const url = new URL(joinInput)
        leagueId = url.searchParams.get('leagueId') || ''
      }
      if (!leagueId) throw new Error('Invalid league ID or link')

      const res = await fetch('/api/leagues/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leagueId }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Join failed')
      setJoinMsg(j.already ? 'You are already a member. ✅' : 'Joined! ✅')
      setJoinInput('')
      await loadLeagues()
    } catch (err: any) {
      setJoinMsg(err?.message || 'Join failed')
    } finally {
      setBusyJoin(false)
    }
  }

  function inviteLink(id: string) {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/join?leagueId=${id}`
  }

  async function copyLink(id: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(id))
      setMsg('Invite link copied!')
      setTimeout(() => setMsg(''), 1500)
    } catch {
      setMsg('Copy failed')
      setTimeout(() => setMsg(''), 2000)
    }
  }

  async function createWrinkle() {
    if (!selectedLeagueId) {
      setWrinkleMsg('Please select a league first')
      return
    }

    setWrinkleMsg('')
    setCreatingWrinkle(true)

    try {
      const needsGame = ['bonus_game', 'bonus_game_ats', 'bonus_game_oof'].includes(wrinkleKind)
      const needsSpread = wrinkleKind === 'bonus_game_ats'

      if (needsGame && !wrinkleGameId) {
        throw new Error('Please select a game')
      }
      if (needsSpread && !wrinkleSpread) {
        throw new Error('Please enter a spread')
      }

      const res = await fetch('/api/admin/wrinkles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          leagueId: selectedLeagueId,
          season: wrinkleSeason,
          week: wrinkleWeek,
          name: wrinkleName,
          status: wrinkleStatus,
          kind: wrinkleKind,
          extraPicks: needsGame ? 1 : 0,
          autoHydrate: wrinkleKind === 'winless_double',
        }),
      })

      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Failed to create wrinkle')

      const wrinkleId = j?.wrinkle?.id || j?.id
      if (!wrinkleId) throw new Error('No wrinkle ID returned')

      // Attach game if needed
      if (needsGame && wrinkleGameId) {
        const payload: any = { gameIds: [wrinkleGameId] }
        if (needsSpread) payload.spreads = { [wrinkleGameId]: parseFloat(wrinkleSpread) }

        const hRes = await fetch(`/api/admin/wrinkles/${wrinkleId}/hydrate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!hRes.ok) {
          const hj = await hRes.json()
          throw new Error(hj?.error || 'Failed to attach game')
        }
      }

      setWrinkleMsg('✅ Wrinkle created!')
      setWrinkleGameId('')
      setWrinkleSpread('')
      await loadWrinkles()
      setTimeout(() => setWrinkleMsg(''), 3000)
    } catch (err: any) {
      setWrinkleMsg(`❌ ${err?.message || 'Failed to create wrinkle'}`)
    } finally {
      setCreatingWrinkle(false)
    }
  }

  async function refreshTeamRecords() {
    setRefreshingRecords(true)
    setRecordsMsg('')

    try {
      const res = await fetch('/api/team-records/calculate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ season: recordsSeason, week: recordsWeek }),
      })

      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Failed to refresh team records')

      setRecordsMsg(`✅ Team records calculated for Week ${recordsWeek}`)
      setTimeout(() => setRecordsMsg(''), 3000)
    } catch (err: any) {
      setRecordsMsg(`❌ ${err?.message || 'Failed to refresh team records'}`)
    } finally {
      setRefreshingRecords(false)
    }
  }

  async function runAutoAssignPicks() {
    if (!selectedLeagueId) {
      setAutoAssignMsg('Please select a league first')
      return
    }

    setAutoAssigning(true)
    setAutoAssignMsg('')

    try {
      const res = await fetch('/api/admin/auto-assign-picks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 
          season: autoAssignSeason, 
          week: autoAssignWeek,
          leagueId: selectedLeagueId
        }),
      })

      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Failed to auto-assign picks')

      // Build success message
      const processed = j.processed || {}
      const leagueResult = processed[selectedLeagueId]
      
      if (!leagueResult || leagueResult.assignments.length === 0) {
        setAutoAssignMsg('✅ No picks needed - all users have 2 picks for this week')
      } else {
        const totalAssigned = leagueResult.assignments.reduce((sum: number, a: any) => sum + a.picksAssigned, 0)
        const userCount = leagueResult.assignments.length
        setAutoAssignMsg(`✅ Assigned ${totalAssigned} pick(s) to ${userCount} user(s) for Week ${autoAssignWeek}`)
      }

      setTimeout(() => setAutoAssignMsg(''), 5000)
    } catch (err: any) {
      setAutoAssignMsg(`❌ ${err?.message || 'Failed to auto-assign picks'}`)
    } finally {
      setAutoAssigning(false)
    }
  }

  const selectedLeague = leagues.find(l => l.id === selectedLeagueId)
  const needsGame = ['bonus_game', 'bonus_game_ats', 'bonus_game_oof'].includes(wrinkleKind)
  const needsSpread = wrinkleKind === 'bonus_game_ats'

  const gameOptions = games.map(g => {
    const h = teams[g.home.id]
    const a = teams[g.away.id]
    const hAbbr = h?.abbreviation || g.home.abbr || 'H'
    const aAbbr = a?.abbreviation || g.away.abbr || 'A'
    return {
      value: g.id,
      label: `${aAbbr} @ ${hAbbr} • ${new Date(g.game_utc).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
    }
  })

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Admin</h1>

      {/* Global Admin Tools */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5 mb-6">
        <h2 className="text-lg font-semibold mb-3">Global Admin Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/admin/teams" className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group">
            <div className="font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">🎨 Team Colors</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">Manage light & dark mode colors for all teams</div>
          </Link>
          <Link href="/admin/schedule" className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group">
            <div className="font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">📅 Global Schedule</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">Sync schedule from ESPN</div>
          </Link>
          <Link href="/admin/invites" className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group">
            <div className="font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">✉️ Invites</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">Manage league invitations</div>
          </Link>
        </div>
      </section>

      {/* League-Specific Management */}
      {leagues.length > 0 && (
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5 mb-6">
          <h2 className="text-lg font-semibold mb-3">League Management</h2>
          <label className="grid gap-1 mb-4">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Select League</span>
            <select
              className="border rounded px-3 py-2 bg-transparent dark:border-neutral-700"
              value={selectedLeagueId}
              onChange={(e) => setSelectedLeagueId(e.target.value)}
            >
              <option value="">Choose a league...</option>
              {leagues.map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l.season})</option>
              ))}
            </select>
          </label>

          {selectedLeague && (
            <div className="grid gap-4">
              {/* Manage League Button */}
              <div className="pb-4 border-b dark:border-neutral-700">
                <Link 
                  href={`/admin/leagues/${selectedLeagueId}`}
                  className="inline-block px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                >
                  👥 Manage League (Members, Invites, Manual Picks)
                </Link>
                <p className="text-xs text-neutral-500 mt-2">Manage members, roles, invites, and create picks for users</p>
              </div>

              {/* Auto-Assign Picks */}
              <div className="border-t pt-4 dark:border-neutral-700">
                <h3 className="font-semibold mb-3">🤖 Auto-Assign Missed Picks</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">Automatically assign picks to users who missed the weekly deadline. Assigns losing teams (95%) or lowest-scoring teams (5%).</p>
                
                <div className="flex gap-3 items-end mb-3">
                  <label className="grid gap-1">
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">Season</span>
                    <input type="number" className="h-9 w-24 border rounded px-2 bg-transparent dark:border-neutral-700" value={autoAssignSeason} onChange={e => setAutoAssignSeason(+e.target.value)} />
                  </label>
                  <label className="grid gap-1 flex-1">
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">Week</span>
                    <select className="h-9 border rounded px-2 bg-transparent dark:border-neutral-700" value={autoAssignWeek} onChange={e => setAutoAssignWeek(+e.target.value)}>
                      {Array.from({ length: 18 }).map((_, i) => <option key={i + 1} value={i + 1}>Week {i + 1}</option>)}
                    </select>
                  </label>
                  <button onClick={runAutoAssignPicks} disabled={autoAssigning} className="h-9 px-4 rounded bg-black text-white disabled:opacity-50">
                    {autoAssigning ? 'Assigning...' : 'Auto-Assign'}
                  </button>
                </div>
                {autoAssignMsg && <div className="text-sm">{autoAssignMsg}</div>}
                <p className="text-xs text-neutral-500 mt-2">⚠️ Only runs if all games for the week are FINAL</p>
              </div>

              {/* Wrinkles Management */}
              <div className="border-t pt-4 dark:border-neutral-700">
                <h3 className="font-semibold mb-3">🎲 Manage Wrinkles</h3>
                
                <div className="grid gap-3 mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1">
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">Season</span>
                      <input type="number" className="h-9 border rounded px-2 bg-transparent dark:border-neutral-700" value={wrinkleSeason} onChange={e => setWrinkleSeason(+e.target.value)} />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">Week</span>
                      <input type="number" className="h-9 border rounded px-2 bg-transparent dark:border-neutral-700" value={wrinkleWeek} onChange={e => setWrinkleWeek(+e.target.value)} />
                    </label>
                  </div>

                  <label className="grid gap-1">
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">Type</span>
                    <select className="h-9 border rounded px-2 bg-transparent dark:border-neutral-700" value={wrinkleKind} onChange={e => setWrinkleKind(e.target.value as WrinkleKind)}>
                      {WRINKLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <span className="text-xs text-neutral-500">{WRINKLE_TYPES.find(t => t.value === wrinkleKind)?.description}</span>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">Name</span>
                    <input className="h-9 border rounded px-2 bg-transparent dark:border-neutral-700" value={wrinkleName} onChange={e => setWrinkleName(e.target.value)} />
                  </label>

                  {needsGame && (
                    <label className="grid gap-1">
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">Game</span>
                      <select className="h-9 border rounded px-2 bg-transparent dark:border-neutral-700" value={wrinkleGameId} onChange={e => setWrinkleGameId(e.target.value)}>
                        <option value="">Select game...</option>
                        {gameOptions.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                      </select>
                    </label>
                  )}

                  {needsSpread && (
                    <label className="grid gap-1">
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">Spread (e.g., -3.5)</span>
                      <input className="h-9 border rounded px-2 bg-transparent dark:border-neutral-700" value={wrinkleSpread} onChange={e => setWrinkleSpread(e.target.value)} placeholder="-3.5" />
                    </label>
                  )}

                  {wrinkleKind === 'winless_double' && (
                    <div className="p-3 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-900 dark:text-blue-100">
                      <strong>Winless Double:</strong> Will auto-detect teams with 0 wins and mark existing picks for 2x points.
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <button onClick={createWrinkle} disabled={creatingWrinkle} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">
                    {creatingWrinkle ? 'Creating...' : 'Create Wrinkle'}
                  </button>
                  {wrinkleMsg && <span className="text-sm">{wrinkleMsg}</span>}
                </div>

                {wrinkles.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Existing Wrinkles - Week {wrinkleWeek}</h4>
                    <ul className="grid gap-2">
                      {wrinkles.map(w => (
                        <li key={w.id} className="flex items-center justify-between border rounded px-3 py-2 dark:border-neutral-700 text-sm">
                          <div>
                            <div className="font-medium">{w.name}</div>
                            <div className="text-xs text-neutral-500">{WRINKLE_TYPES.find(t => t.value === w.kind)?.label} • {w.status}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Team Records */}
              <div className="border-t pt-4 dark:border-neutral-700">
                <h3 className="font-semibold mb-3">📊 Team Records Calculator</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">Calculate team records for Winless Double and OOF wrinkles.</p>
                
                <div className="flex gap-3 items-end mb-3">
                  <label className="grid gap-1">
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">Season</span>
                    <input type="number" className="h-9 w-24 border rounded px-2 bg-transparent dark:border-neutral-700" value={recordsSeason} onChange={e => setRecordsSeason(+e.target.value)} />
                  </label>
                  <label className="grid gap-1 flex-1">
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">Week</span>
                    <select className="h-9 border rounded px-2 bg-transparent dark:border-neutral-700" value={recordsWeek} onChange={e => setRecordsWeek(+e.target.value)}>
                      {Array.from({ length: 18 }).map((_, i) => <option key={i + 1} value={i + 1}>Week {i + 1}</option>)}
                    </select>
                  </label>
                  <button onClick={refreshTeamRecords} disabled={refreshingRecords} className="h-9 px-4 rounded bg-black text-white disabled:opacity-50">
                    {refreshingRecords ? 'Calculating...' : 'Refresh'}
                  </button>
                </div>
                {recordsMsg && <div className="text-sm">{recordsMsg}</div>}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Create League */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5 mb-6">
        <h2 className="text-lg font-semibold mb-3">Create a league</h2>
        <form onSubmit={createLeague} className="grid gap-3 max-w-xl">
          <label className="grid gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Name</span>
            <input className="border rounded px-3 py-2 bg-transparent dark:border-neutral-700" value={name} onChange={(e) => setName(e.target.value)} placeholder="2025 Big Board" required />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Season</span>
            <input type="number" className="border rounded px-3 py-2 bg-transparent dark:border-neutral-700" value={season} onChange={(e) => setSeason(Number(e.target.value))} min={2000} max={3000} required />
          </label>
          <div className="flex items-center gap-3">
            <button disabled={busyCreate} className="px-4 py-2 rounded-lg border dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50">
              {busyCreate ? 'Creating…' : 'Create league'}
            </button>
            {msg && <span className="text-sm">{msg}</span>}
          </div>
        </form>
      </section>

      {/* Join League */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5 mb-6">
        <h2 className="text-lg font-semibold mb-3">Join a league</h2>
        <form onSubmit={joinExisting} className="flex flex-col sm:flex-row gap-3 max-w-xl">
          <input className="border rounded px-3 py-2 bg-transparent dark:border-neutral-700 flex-1" placeholder="Paste invite link or league id…" value={joinInput} onChange={(e) => setJoinInput(e.target.value)} />
          <button disabled={busyJoin} className="px-4 py-2 rounded-lg border dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50">
            {busyJoin ? 'Joining…' : 'Join'}
          </button>
        </form>
        {joinMsg && <p className="text-sm mt-2">{joinMsg}</p>}
      </section>

      {/* Your Leagues */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
        <h2 className="text-lg font-semibold mb-3">Your leagues</h2>
        {leagues.length === 0 ? (
          <div className="text-sm text-neutral-500 dark:text-neutral-400">No leagues yet</div>
        ) : (
          <ul className="grid gap-2">
            {leagues.map((league) => (
              <li key={league.id} className="flex items-center justify-between border rounded-lg px-3 py-2 dark:border-neutral-700">
                <div>
                  <div className="font-semibold">{league.name}</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">Season {league.season}</div>
                </div>
                <button onClick={() => copyLink(league.id)} className="text-xs px-2 py-1 rounded border dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                  Copy invite link
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
