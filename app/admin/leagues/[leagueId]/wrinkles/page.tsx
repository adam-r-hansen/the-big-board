'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Game = {
  id: string
  week: number
  game_utc: string
  home: { id: string; abbr?: string }
  away: { id: string; abbr?: string }
  status?: string | null
}

type Team = { id: string; name: string; abbreviation: string }

type WrinkleKind =
  | 'bonus_game'
  | 'bonus_game_ats'
  | 'bonus_game_oof'
  | 'winless_double'

type Wrinkle = {
  id: string
  name: string
  kind: WrinkleKind
  week: number
  status: string
  extra_picks: number
}

const KINDS: { value: WrinkleKind; label: string; description: string }[] = [
  { 
    value: 'bonus_game', 
    label: 'Bonus Pick', 
    description: 'Extra game pick that doesn\'t count toward season total' 
  },
  { 
    value: 'bonus_game_ats', 
    label: 'Bonus Pick (Against the Spread)', 
    description: 'Extra pick where the point spread must be covered' 
  },
  { 
    value: 'bonus_game_oof', 
    label: 'OOF Bonus Pick', 
    description: 'Extra pick from teams with win percentage below .400' 
  },
  { 
    value: 'winless_double', 
    label: 'Winless Double', 
    description: 'Regular picks of winless teams are worth 2x points if they win' 
  },
]

function fmt(dt: string) { 
  try { 
    return new Date(dt).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  } catch { 
    return dt 
  } 
}

async function readJsonSafe(res: Response) {
  const text = await res.text()
  try {
    return { data: text ? JSON.parse(text) : null, text }
  } catch {
    return { data: null, text }
  }
}

export default function LeagueWrinklesPage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number>(1)

  const [kind, setKind] = useState<WrinkleKind>('bonus_game')
  const [name, setName] = useState('Bonus Pick')
  const [status, setStatus] = useState<'active' | 'paused'>('active')
  const [spread, setSpread] = useState<string>('')
  const [gameId, setGameId] = useState<string>('')

  const [games, setGames] = useState<Game[]>([])
  const [teams, setTeams] = useState<Record<string, Team>>({})
  const [wrinkles, setWrinkles] = useState<Wrinkle[]>([])
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string>('')

  // Load teams
  useEffect(() => {
    fetch('/api/team-map', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(j => setTeams(j.teams || {}))
      .catch(() => {})
  }, [])

  // Load games for selected week
  useEffect(() => {
    setGameId('')
    fetch(`/api/games-for-week?season=${season}&week=${week}`, { credentials: 'same-origin' })
      .then(r => r.json())
      .then(j => {
        const gs: any[] = j.games ?? []
        const normalized = gs.map((x) => ({
          id: x.id,
          game_utc: x.game_utc || x.start_time,
          week: x.week,
          home: { 
            id: x.home?.id || x.home_team,
            abbr: x.home?.abbreviation || x.home_abbr
          },
          away: { 
            id: x.away?.id || x.away_team,
            abbr: x.away?.abbreviation || x.away_abbr
          },
          status: x.status ?? 'UPCOMING'
        })) as Game[]
        setGames(normalized)
      })
      .catch(() => {})
  }, [season, week])

  // Load existing wrinkles
  useEffect(() => {
    loadWrinkles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, season, week])

  async function loadWrinkles() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/wrinkles?leagueId=${leagueId}&season=${season}&week=${week}`, {
        credentials: 'same-origin'
      })
      const j = await res.json()
      setWrinkles(j.wrinkles || [])
    } catch (e) {
      console.error('Load wrinkles error:', e)
    } finally {
      setLoading(false)
    }
  }

  // Update name when kind changes
  useEffect(() => {
    const selected = KINDS.find(k => k.value === kind)
    if (selected) setName(selected.label)
  }, [kind])

  const needsGame = kind === 'bonus_game' || kind === 'bonus_game_ats' || kind === 'bonus_game_oof'
  const needsSpread = kind === 'bonus_game_ats'
  const canSubmit =
    leagueId &&
    season &&
    week &&
    name.trim().length > 0 &&
    status &&
    (!needsGame || !!gameId) &&
    (!needsSpread || spread.trim().length > 0)

  const gameOptions = useMemo(() => {
    return games.map(g => {
      const h = teams[g.home.id]
      const a = teams[g.away.id]
      const hAbbr = h?.abbreviation || g.home.abbr || g.home.id.slice(0, 3).toUpperCase()
      const aAbbr = a?.abbreviation || g.away.abbr || g.away.id.slice(0, 3).toUpperCase()
      const label = `${aAbbr} @ ${hAbbr} • ${fmt(g.game_utc)}`
      return { value: g.id, label }
    })
  }, [games, teams])

  async function onCreate() {
    setMsg('')
    if (!canSubmit) return
    setCreating(true)
    
    try {
      // Create wrinkle
      const createRes = await fetch('/api/admin/wrinkles', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          leagueId,
          season,
          week,
          name,
          status,
          kind,
          extraPicks: needsGame ? 1 : 0,
          autoHydrate: kind === 'winless_double',
        }),
      })
      
      const { data: created, text: createText } = await readJsonSafe(createRes)
      
      if (!createRes.ok) {
        throw new Error(created?.error || `Create failed (${createRes.status})`)
      }
      
      const wrinkleId: string | undefined = created?.wrinkle?.id ?? created?.id
      
      if (!wrinkleId) {
        throw new Error('Create returned no wrinkle ID')
      }

      // Attach game for bonus types
      if (needsGame && gameId) {
        const payload: any = { gameIds: [gameId] }
        if (needsSpread && spread) payload.spreads = { [gameId]: parseFloat(spread) }

        const hRes = await fetch(`/api/admin/wrinkles/${wrinkleId}/hydrate`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        
        const { data: hData } = await readJsonSafe(hRes)
        
        if (!hRes.ok) {
          throw new Error(hData?.error || 'Failed to attach game')
        }
      }

      setMsg('✅ Wrinkle created successfully!')
      setTimeout(() => setMsg(''), 3000)
      
      // Reset form
      setName('')
      setGameId('')
      setSpread('')
      
      // Reload wrinkles
      await loadWrinkles()
      
    } catch (e: any) {
      setMsg(`❌ ${e?.message || 'Failed to create wrinkle'}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href={`/admin/leagues/${leagueId}`} className="text-sm text-blue-600 hover:underline mb-2 inline-block">
          ← Back to League Admin
        </Link>
        <h1 className="text-3xl font-bold">Manage Wrinkles</h1>
      </div>

      {/* Create Wrinkle Section */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 mb-6">
        <h2 className="text-xl font-semibold mb-4">Create Wrinkle</h2>
        
        <div className="grid gap-4">
          {/* Season & Week */}
          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-1">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Season</span>
              <input 
                type="number" 
                className="h-10 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3"
                value={season} 
                onChange={e => setSeason(Number(e.target.value))} 
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Week</span>
              <input 
                type="number" 
                className="h-10 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3"
                value={week} 
                onChange={e => setWeek(Number(e.target.value))} 
              />
            </label>
          </div>

          {/* Wrinkle Type */}
          <label className="grid gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Type</span>
            <select 
              className="h-10 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3"
              value={kind} 
              onChange={e => setKind(e.target.value as WrinkleKind)}
            >
              {KINDS.map(k => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {KINDS.find(k => k.value === kind)?.description}
            </span>
          </label>

          {/* Name */}
          <label className="grid gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Name</span>
            <input 
              type="text" 
              className="h-10 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3"
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Enter wrinkle name" 
            />
          </label>

          {/* Status */}
          <label className="grid gap-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">Status</span>
            <select 
              className="h-10 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3"
              value={status} 
              onChange={e => setStatus(e.target.value as 'active' | 'paused')}
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </label>

          {/* Game Selection (for bonus picks) */}
          {needsGame && (
            <label className="grid gap-1">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Game</span>
              <select 
                className="h-10 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3"
                value={gameId} 
                onChange={e => setGameId(e.target.value)}
              >
                <option value="">Select a game...</option>
                {gameOptions.map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </label>
          )}

          {/* Spread (for ATS) */}
          {needsSpread && (
            <label className="grid gap-1">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                Spread (e.g., -3.5 means home team favored by 3.5)
              </span>
              <input 
                type="text" 
                inputMode="decimal"
                className="h-10 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3"
                value={spread} 
                onChange={e => setSpread(e.target.value)} 
                placeholder="-3.5"
              />
            </label>
          )}

          {/* Winless Double Info */}
          {kind === 'winless_double' && (
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Winless Double:</strong> When created, this will automatically identify teams with 0 wins 
                entering Week {week} and mark any existing picks of those teams for 2x points.
              </p>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!canSubmit || creating}
              onClick={onCreate}
              className="h-10 px-4 rounded-md bg-black text-white disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Wrinkle'}
            </button>
            {msg && <span className="text-sm">{msg}</span>}
          </div>
        </div>
      </section>

      {/* Existing Wrinkles */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
        <h2 className="text-xl font-semibold mb-4">
          Existing Wrinkles — Week {week}
        </h2>
        
        {loading && (
          <div className="text-sm text-neutral-500">Loading...</div>
        )}
        
        {!loading && wrinkles.length === 0 && (
          <div className="text-sm text-neutral-500">No wrinkles for this week yet.</div>
        )}
        
        {!loading && wrinkles.length > 0 && (
          <ul className="grid gap-2">
            {wrinkles.map(w => (
              <li 
                key={w.id} 
                className="flex items-center justify-between border rounded-lg px-4 py-3 dark:border-neutral-700"
              >
                <div>
                  <div className="font-semibold">{w.name}</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {KINDS.find(k => k.value === w.kind)?.label} • {w.status}
                    {w.extra_picks > 0 && ` • +${w.extra_picks} pick${w.extra_picks !== 1 ? 's' : ''}`}
                  </div>
                </div>
                <span className="text-xs uppercase tracking-wide text-neutral-500">
                  Week {w.week}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
