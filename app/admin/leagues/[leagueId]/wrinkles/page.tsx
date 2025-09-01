// app/admin/leagues/[leagueId]/wrinkles/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type Game = {
  id: string
  week: number
  game_utc: string
  home: { id: string }
  away: { id: string }
  status?: string | null
}

type Team = { id: string; name: string; abbreviation: string }

type WrinkleKind =
  | 'bonus_game'
  | 'bonus_game_ats'
  | 'bonus_game_oof'
  | 'winless_double'

const KINDS: { value: WrinkleKind; label: string }[] = [
  { value: 'bonus_game', label: 'Bonus game' },
  { value: 'bonus_game_ats', label: 'Bonus game (Against the Spread)' },
  { value: 'bonus_game_oof', label: 'Bonus game (OOF: < .400)' },
  { value: 'winless_double', label: 'Winless double' },
]

function fmt(dt: string) { try { return new Date(dt).toLocaleString() } catch { return dt } }

// Parse response safely (works for empty or non-JSON bodies)
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
  const [extraPicks, setExtraPicks] = useState<number>(1)
  const [spread, setSpread] = useState<string>('')  // ATS only
  const [gameId, setGameId] = useState<string>('')

  const [games, setGames] = useState<Game[]>([])
  const [teams, setTeams] = useState<Record<string, Team>>({})
  const [creating, setCreating] = useState(false)
  const [log, setLog] = useState<string>('')

  useEffect(() => {
    fetch('/api/team-map', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(j => setTeams(j.teams || {}))
      .catch(() => {})
  }, [])

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
          home: { id: x.home?.id || x.home_team },
          away: { id: x.away?.id || x.away_team },
          status: x.status ?? 'UPCOMING'
        })) as Game[]
        setGames(normalized)
      })
      .catch((e) => setLog(`load games error: ${e instanceof Error ? e.message : 'error'}`))
  }, [season, week])

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
      const label = `${h?.abbreviation || g.home.id} vs ${a?.abbreviation || g.away.id} • ${fmt(g.game_utc)}`
      return { value: g.id, label }
    })
  }, [games, teams])

  async function onCreate() {
    setLog('')
    if (!canSubmit) return
    setCreating(true)
    try {
      // 1) Create wrinkle
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
          extraPicks: ['bonus_game','bonus_game_ats','bonus_game_oof'].includes(kind) ? extraPicks : 0,
          autoHydrate: false,
        }),
      })
      const { data: created, text: createText } = await readJsonSafe(createRes)
      if (!createRes.ok) {
        throw new Error(created?.error || `create failed (${createRes.status}) ${createText?.slice(0,200)}`)
      }
      const wrinkleId: string | undefined =
        created?.wrinkle?.id ?? created?.id
      if (!wrinkleId) {
        throw new Error(`create returned no id (status ${createRes.status}; body: ${createText?.slice(0,200) || 'empty'})`)
      }

      // 2) Attach game for bonus types
      if (needsGame && gameId) {
        const payload: any = { gameIds: [gameId] }
        if (needsSpread && spread) payload.spreads = { [gameId]: Number(spread) }

        const hRes = await fetch(`/api/admin/wrinkles/${wrinkleId}/hydrate`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const { data: hData, text: hText } = await readJsonSafe(hRes)
        if (!hRes.ok) {
          throw new Error(hData?.error || `hydrate failed (${hRes.status}) ${hText?.slice(0,200)}`)
        }
      }

      setLog('✅ Created')
    } catch (e) {
      setLog(`❌ ${e instanceof Error ? e.message : 'error'}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Wrinkles — Admin</h1>
        <a href={`/admin/leagues/${leagueId}`} className="text-sm underline">← Back to League Admin</a>
      </header>

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5 grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">Season
            <input type="number" className="block mt-1 w-full h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                   value={season} onChange={e => setSeason(+e.target.value)} />
          </label>
          <label className="text-sm">Week
            <input type="number" className="block mt-1 w-full h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                   value={week} onChange={e => setWeek(+e.target.value)} />
          </label>
        </div>

        <label className="text-sm">Type
          <select className="block mt-1 w-full h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                  value={kind} onChange={e => setKind(e.target.value as WrinkleKind)}>
            {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </label>

        <label className="text-sm">Name
          <input type="text" className="block mt-1 w-full h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                 value={name} onChange={e => setName(e.target.value)} placeholder="Bonus Pick" />
        </label>

        <label className="text-sm">Status
          <select className="block mt-1 w-full h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                  value={status} onChange={e => setStatus(e.target.value as 'active' | 'paused')}>
            <option value="active">active</option>
            <option value="paused">paused</option>
          </select>
        </label>

        {['bonus_game','bonus_game_ats','bonus_game_oof'].includes(kind) && (
          <>
            <label className="text-sm">Game
              <select className="block mt-1 w-full h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                      value={gameId} onChange={e => setGameId(e.target.value)}>
                <option value="">Select…</option>
                {gameOptions.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </label>

            {kind === 'bonus_game_ats' && (
              <label className="text-sm">Spread (e.g. -3.5; positive favors away)
                <input type="text" inputMode="decimal"
                       className="block mt-1 w-full h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                       value={spread} onChange={e => setSpread(e.target.value)} />
              </label>
            )}

            <label className="text-sm">Extra picks granted (this week)
              <input type="number" className="block mt-1 w-full h-9 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                     value={extraPicks} onChange={e => setExtraPicks(Math.max(0, +e.target.value))} />
            </label>
          </>
        )}

        {kind === 'winless_double' && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Winless double: Pick counts against season quota. If team has 0 wins at pick time, points are doubled.
          </p>
        )}

        <div className="flex items-center gap-3">
          <button type="button" disabled={!canSubmit || creating} onClick={onCreate}
                  className="h-9 px-4 rounded-md bg-black text-white disabled:opacity-50">
            {creating ? 'Creating…' : 'Create wrinkle'}
          </button>
          {log && <span className="text-sm">{log}</span>}
        </div>
      </section>
    </main>
  )
}
