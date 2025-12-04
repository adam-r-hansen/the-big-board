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

  // Wrinkles
  const [wrinkleSeason, setWrinkleSeason] = useState(new Date().getFullYear())
  const [wrinkleWeek, setWrinkleWeek] = useState(1)
  const [wrinkleKind, setWrinkleKind] = useState<WrinkleKind>('bonus_game')
  const [wrinkleName, setWrinkleName] = useState('Bonus Pick')
  const [wrinkleStatus, setWrinkleStatus] = useState<'active' | 'paused'>('active')
  const [wrinkleGameId, setWrinkleGameId] = useState('')
  const [wrinkleSpread, setWrinkleSpread] = useState('')
  const [wrinkleMsg, setWrinkleMsg] = useState('')
  const [creatingWrinkle, setCreatingWrinkle] = useState(false)
  const [wrinkles, setWrinkles] = useState<Wrinkle[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [teams, setTeams] = useState<Record<string, Team>>({})

  // Team Records
  const [recordsSeason, setRecordsSeason] = useState(new Date().getFullYear())
  const [recordsWeek, setRecordsWeek] = useState(1)
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

  // Load wrinkles when week changes
  useEffect(() => {
    if (selectedLeagueId && wrinkleSeason && wrinkleWeek) {
      loadWrinkles()
    }
  }, [selectedLeagueId, wrinkleSeason, wrinkleWeek])

  async function loadLeagues() {
    try {
      const res = await fetch('/api/my-leagues', { cache: 'no-store' })
      const j = await res.json()
      setLeagues(j.leagues || [])
      if (j.leagues?.[0]) {
        setSelectedLeagueId(j.leagues[0].id)
        setSeason(j.leagues[0].season)
        setWrinkleSeason(j.leagues[0].season)
      }
    } catch (e: any) {
      setMsg(e?.message || 'Failed to load leagues')
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
      setGames((j.games || []).map((g: any) => ({
        id: g.id,
        game_utc: g.game_utc || g.start_time,
        home: { id: g.home?.id || g.home_team, abbr: g.home?.abbreviation },
        away: { id: g.away?.id || g.away_team, abbr: g.away?.abbreviation },
      })))
    } catch {}
  }

  async function loadWrinkles() {
    try {
      const res = await fetch(`/api/wrinkles/active?leagueId=${selectedLeagueId}&season=${wrinkleSeason}&week=${wrinkleWeek}`)
      const j = await res.json()
      setWrinkles(j.wrinkles || [])
    } catch {}
  }

  async function createLeague() {
    if (!name.trim()) {
      setMsg('Please enter a league name')
      return
    }

    setBusyCreate(true)
    setMsg('')

    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, season }),
      })

      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Failed to create league')

      setMsg('✅ League created!')
      setName('')
      await loadLeagues()
      setTimeout(() => setMsg(''), 3000)
    } catch (err: any) {
      setMsg(`❌ ${err?.message || 'Failed to create league'}`)
    } finally {
      setBusyCreate(false)
    }
  }

  async function joinLeague() {
    if (!joinInput.trim()) {
      setJoinMsg('Please enter a league ID or invite link')
      return
    }

    setJoinMsg('')

    try {
      // Extract league ID from input (supports full URL or just ID)
      let leagueId = joinInput.trim()
      try {
        const url = new URL(joinInput)
        const id = url.searchParams.get('leagueId')
        if (id) leagueId = id
      } catch {}

      const res = await fetch('/api/leagues/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leagueId }),
      })

      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Failed to join league')

      setJoinMsg('✅ Joined league!')
      setJoinInput('')
      await loadLeagues()
      setTimeout(() => setJoinMsg(''), 3000)
    } catch (err: any) {
      setJoinMsg(`❌ ${err?.message || 'Failed to join league'}`)
    }
  }

  // OOF wrinkles don't need manual game selection
  const isOOF = wrinkleKind === 'bonus_game_oof'
  const needsGame = (wrinkleKind === 'bonus_game' || wrinkleKind === 'bonus_game_ats') && !isOOF
  const needsSpread = wrinkleKind === 'bonus_game_ats'

  const gameOptions = games.map(g => {
    const home = teams[g.home.id]
    const away = teams[g.away.id]
    const label = `${away?.abbreviation || g.away.abbr || '?'} @ ${home?.abbreviation || g.home.abbr || '?'} • ${new Date(g.game_utc).toLocaleString()}`
    return { value: g.id, label }
  })

  async function createWrinkle() {
    if (!selectedLeagueId) {
      setWrinkleMsg('Please select a league first')
      return
    }

    setWrinkleMsg('')
    setCreatingWrinkle(true)

    try {
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
          extraPicks: (needsGame || isOOF) ? 1 : 0,
          autoHydrate: wrinkleKind === 'winless_double',
        }),
      })

      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Failed to create wrinkle')

      const wrinkleId = j?.wrinkle?.id || j?.id
      if (!wrinkleId) throw new Error('No wrinkle ID returned')

      // Handle OOF auto-hydration
      if (isOOF) {
        const oofRes = await fetch(`/api/admin/wrinkles/${wrinkleId}/hydrate-oof`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
        })

        if (!oofRes.ok) {
          const oofData = await oofRes.json()
          throw new Error(oofData?.error || 'Failed to auto-populate OOF games')
        }

        const oofData = await oofRes.json()
        setWrinkleMsg(`✅ Created with ${oofData?.qualifying_games || 0} qualifying games (using Week ${oofData?.records_week || wrinkleWeek - 1} records)`)
      }
      // Attach game for regular bonus picks
      else if (needsGame && wrinkleGameId) {
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
        
        setWrinkleMsg('✅ Wrinkle created!')
      } else {
        setWrinkleMsg('✅ Wrinkle created!')
      }

      setWrinkleGameId('')
      setWrinkleSpread('')
      await loadWrinkles()
      setTimeout(() => setWrinkleMsg(''), 5000)
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
      const res = await fetch('/api/admin/update-team-records', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ season: recordsSeason, week: recordsWeek }),
      })

      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Failed to update records')

      setRecordsMsg(`✅ Updated ${j.teams || 0} teams through Week ${j.week}`)
      setTimeout(() => setRecordsMsg(''), 5000)
    } catch (err: any) {
      setRecordsMsg(`❌ ${err?.message || 'Failed to update records'}`)
    } finally {
      setRefreshingRecords(false)
    }
  }

  async function autoAssignPicks() {
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
          leagueId: selectedLeagueId,
          season: autoAssignSeason,
          week: autoAssignWeek,
        }),
      })

      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Failed to auto-assign picks')

      setAutoAssignMsg(`✅ ${j.message || 'Picks assigned'}`)
      setTimeout(() => setAutoAssignMsg(''), 5000)
    } catch (err: any) {
      setAutoAssignMsg(`❌ ${err?.message || 'Failed to auto-assign picks'}`)
    } finally {
      setAutoAssigning(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 grid gap-8">
      <header>
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-neutral-600 dark:text-neutral-400">Manage leagues, wrinkles, and global settings</p>
      </header>

      {/* Global Admin Tools */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
        <h2 className="text-xl font-semibold mb-4">Global Admin Tools</h2>
        
        <div className="grid md:grid-cols-3 gap-4">
          <Link href="/admin/teams" className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
            <div className="text-2xl mb-2">🎨</div>
            <div className="font-semibold">Team Colors</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Manage light & dark mode colors for all teams</div>
          </Link>

          <Link href="/admin/schedule" className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
            <div className="text-2xl mb-2">🗓️</div>
            <div className="font-semibold">Global Schedule</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Sync schedule from ESPN</div>
          </Link>

          <Link href="/admin/invites" className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
            <div className="text-2xl mb-2">✉️</div>
            <div className="font-semibold">Invites</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Manage league invitations</div>
          </Link>
        </div>
      </section>

      {/* League Management */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
        <h2 className="text-xl font-semibold mb-4">League Management</h2>

        <div className="mb-4">
          <label className="grid gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Select League</span>
            <select
              className="h-10 border rounded px-2 bg-transparent dark:border-neutral-700"
              value={selectedLeagueId}
              onChange={e => setSelectedLeagueId(e.target.value)}
            >
              <option value="">Select a league...</option>
              {leagues.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.season})
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedLeagueId && (
          <Link
            href={`/admin/leagues/${selectedLeagueId}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <span>🎯</span>
            <span className="font-semibold">Manage League (Members, Invites, Manual Picks)</span>
          </Link>
        )}

        {selectedLeagueId && <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">Manage members, roles, invites, and create picks for users</p>}

        {/* Auto-Assign Missed Picks */}
        {selectedLeagueId && (
          <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-800">
            <h3 className="font-semibold mb-3">🤖 Auto-Assign Missed Picks</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
              Automatically assign picks to users who missed the weekly deadline. Assigns losing teams (95%) or lowest-scoring teams (5%).
            </p>

            <div className="grid md:grid-cols-3 gap-3 mb-3">
              <label className="grid gap-1">
                <span className="text-xs text-neutral-600 dark:text-neutral-400">Season</span>
                <input
                  type="number"
                  className="h-9 border rounded px-2 bg-transparent dark:border-neutral-700"
                  value={autoAssignSeason}
                  onChange={e => setAutoAssignSeason(+e.target.value)}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-neutral-600 dark:text-neutral-400">Week</span>
                <select
                  className="h-9 border rounded px-2 bg-transparent dark:border-neutral-700"
                  value={autoAssignWeek}
                  onChange={e => setAutoAssignWeek(+e.target.value)}
                >
                  {Array.from({ length: 18 }, (_, i) => i + 1).map(w => (
                    <option key={w} value={w}>Week {w}</option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  onClick={autoAssignPicks}
                  disabled={autoAssigning}
                  className="h-9 w-full px-4 rounded bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
                >
                  {autoAssigning ? 'Assigning...' : 'Auto-Assign'}
                </button>
              </div>
            </div>
            
            <div className="p-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-100">
              <strong>⚠️ Only runs if all games for the week are FINAL</strong>
            </div>

            {autoAssignMsg && <div className="mt-2 text-sm">{autoAssignMsg}</div>}
          </div>
        )}

        {/* Manage Wrinkles */}
        {selectedLeagueId && (
          <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-800">
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

              {isOOF && (
                <div className="p-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-100">
                  <strong>OOF Bonus Pick:</strong> Games will be automatically selected based on teams with win percentage below .400 using Week {wrinkleWeek - 1} records.
                </div>
              )}

              {needsGame && !isOOF && (
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

            <div className="flex items-center gap-3">
              <button
                onClick={createWrinkle}
                disabled={creatingWrinkle || !selectedLeagueId}
                className="px-4 py-2 rounded bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
              >
                {creatingWrinkle ? 'Creating...' : 'Create Wrinkle'}
              </button>
              {wrinkleMsg && <span className="text-sm">{wrinkleMsg}</span>}
            </div>

            {wrinkles.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2">Existing Wrinkles - Week {wrinkleWeek}</h4>
                <ul className="grid gap-2">
                  {wrinkles.map(w => (
                    <li key={w.id} className="flex items-center justify-between border rounded px-3 py-2 dark:border-neutral-700 text-sm">
                      <div>
                        <div className="font-medium">{w.name}</div>
                        <div className="text-xs text-neutral-500">
                          {WRINKLE_TYPES.find(t => t.value === w.kind)?.label} • {w.status} • +{w.extra_picks} pick{w.extra_picks !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Team Records Update */}
        {selectedLeagueId && (
          <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-800">
            <h3 className="font-semibold mb-3">📊 Update Team Records</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
              Calculate cumulative team win-loss records for OOF wrinkle eligibility.
            </p>

            <div className="grid md:grid-cols-3 gap-3 mb-3">
              <label className="grid gap-1">
                <span className="text-xs text-neutral-600 dark:text-neutral-400">Season</span>
                <input
                  type="number"
                  className="h-9 border rounded px-2 bg-transparent dark:border-neutral-700"
                  value={recordsSeason}
                  onChange={e => setRecordsSeason(+e.target.value)}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-neutral-600 dark:text-neutral-400">Week</span>
                <input
                  type="number"
                  className="h-9 border rounded px-2 bg-transparent dark:border-neutral-700"
                  value={recordsWeek}
                  onChange={e => setRecordsWeek(+e.target.value)}
                />
              </label>
              <div className="flex items-end">
                <button
                  onClick={refreshTeamRecords}
                  disabled={refreshingRecords}
                  className="h-9 w-full px-4 rounded bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
                >
                  {refreshingRecords ? 'Updating...' : 'Update Records'}
                </button>
              </div>
            </div>

            {recordsMsg && <div className="text-sm">{recordsMsg}</div>}
          </div>
        )}
      </section>

      {/* Create New League */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
        <h2 className="text-xl font-semibold mb-4">Create New League</h2>

        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <label className="grid gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">League Name</span>
            <input
              className="h-10 border rounded px-2 bg-transparent dark:border-neutral-700"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My League"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Season</span>
            <input
              type="number"
              className="h-10 border rounded px-2 bg-transparent dark:border-neutral-700"
              value={season}
              onChange={e => setSeason(+e.target.value)}
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={createLeague}
            disabled={busyCreate || !name.trim()}
            className="px-4 py-2 rounded bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
          >
            {busyCreate ? 'Creating...' : 'Create League'}
          </button>
          {msg && <span className="text-sm">{msg}</span>}
        </div>
      </section>

      {/* Join League */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
        <h2 className="text-xl font-semibold mb-4">Join Existing League</h2>

        <div className="mb-3">
          <label className="grid gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Invite Link or League ID</span>
            <input
              className="h-10 border rounded px-2 bg-transparent dark:border-neutral-700"
              value={joinInput}
              onChange={e => setJoinInput(e.target.value)}
              placeholder="https://... or 00000000-0000-0000-0000-000000000000"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={joinLeague}
            disabled={!joinInput.trim()}
            className="px-4 py-2 rounded bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
          >
            Join League
          </button>
          {joinMsg && <span className="text-sm">{joinMsg}</span>}
        </div>
      </section>
    </main>
  )
}
