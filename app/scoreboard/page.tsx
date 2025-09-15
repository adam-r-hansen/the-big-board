'use client'

import { useEffect, useMemo, useState } from 'react'
import GameCard, { type GameCardData } from '@/components/ui/GameCard'

type TeamMapEntry = {
  id: string
  abbreviation?: string | null
  name?: string | null
  logo?: string | null
  logo_dark?: string | null
}

type RawGame = {
  id: string
  season: number
  week: number
  game_utc: string
  status?: string
  home: { id?: string; abbr?: string | null; score?: number | null }
  away: { id?: string; abbr?: string | null; score?: number | null }
  // tolerate alternate shapes too:
  home_team?: string
  away_team?: string
  home_score?: number | null
  away_score?: number | null
}

// ---------------------------------------------
// NFL week helpers (Tuesday → Monday windows)
// ---------------------------------------------
function currentSeasonForToday(d = new Date()) {
  // If we're in Sept (8)–Dec (11): use current year
  // If we're in Jan–Feb: that’s still the previous season
  const m = d.getMonth()
  return m >= 8 ? d.getFullYear() : d.getFullYear() - 1
}

function firstMondayOfSeptember(year: number) {
  const d = new Date(year, 8, 1) // Sep 1, local time
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1) // 1 = Monday
  return d
}

function nflKickoffThursday(year: number) {
  // NFL kickoff = first Thursday after Labor Day (first Monday of Sep)
  const laborMon = firstMondayOfSeptember(year)
  const d = new Date(laborMon)
  while (d.getDay() !== 4) d.setDate(d.getDate() + 1) // 4 = Thursday
  return d
}

function week1StartTuesday(year: number) {
  const th = nflKickoffThursday(year)
  const tues = new Date(th)
  tues.setDate(tues.getDate() - 2) // Tuesday of kickoff week
  tues.setHours(0, 0, 0, 0)
  return tues
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function currentNflWeek(year: number, today = new Date()) {
  const start = week1StartTuesday(year).getTime()
  const now = new Date(today)
  now.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((now.getTime() - start) / (1000 * 60 * 60 * 24))
  const w = Math.floor(diffDays / 7) + 1
  // Regular season weeks 1..18
  return clamp(w, 1, 18)
}

// ---------------------------------------------
// fetch helpers
// ---------------------------------------------
async function getJSON<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

// unify various backend shapes into GameCardData
function normalizeGames(rows: any[], teamMap: Record<string, TeamMapEntry>): GameCardData[] {
  return (rows || []).map((x: any) => {
    const id: string = x.id
    const season: number = x.season
    const week: number = x.week
    const game_utc: string = x.game_utc || x.start_time

    // Try to resolve IDs and abbrs from multiple shapes
    const homeId = x.home?.id ?? x.home_team ?? x.homeTeamId ?? x.home_team_id
    const awayId = x.away?.id ?? x.away_team ?? x.awayTeamId ?? x.away_team_id

    const homeAbbr = x.home?.abbr ?? x.home?.abbreviation ?? x.home_abbr ?? null
    const awayAbbr = x.away?.abbr ?? x.away?.abbreviation ?? x.away_abbr ?? null

    const homeScore = x.home?.score ?? x.home_score ?? null
    const awayScore = x.away?.score ?? x.away_score ?? null

    const status = (x.status ?? 'UPCOMING') as GameCardData['status']

    const homeTeam = teamMap[homeId as string]
    const awayTeam = teamMap[awayId as string]

    return {
      id,
      week,
      game_utc,
      status,
      home: {
        id: homeId,
        abbr: homeAbbr ?? homeTeam?.abbreviation ?? null,
        name: homeTeam?.name ?? null,
        score: typeof homeScore === 'number' ? homeScore : null,
        logo: homeTeam?.logo ?? null,
        color_primary: (homeTeam as any)?.color_primary,
        color_secondary: (homeTeam as any)?.color_secondary,
        color_tertiary: (homeTeam as any)?.color_tertiary,
        color_quaternary: (homeTeam as any)?.color_quaternary,
        ui_light_color_key: (homeTeam as any)?.ui_light_color_key,
        ui_dark_color_key: (homeTeam as any)?.ui_dark_color_key,
        color_pref_light: (homeTeam as any)?.color_pref_light,
        color_pref_dark: (homeTeam as any)?.color_pref_dark,
      },
      away: {
        id: awayId,
        abbr: awayAbbr ?? awayTeam?.abbreviation ?? null,
        name: awayTeam?.name ?? null,
        score: typeof awayScore === 'number' ? awayScore : null,
        logo: awayTeam?.logo ?? null,
        color_primary: (awayTeam as any)?.color_primary,
        color_secondary: (awayTeam as any)?.color_secondary,
        color_tertiary: (awayTeam as any)?.color_tertiary,
        color_quaternary: (awayTeam as any)?.color_quaternary,
        ui_light_color_key: (awayTeam as any)?.ui_dark_color_key, // away pill still uses team keys—fine either way
        ui_dark_color_key: (awayTeam as any)?.ui_dark_color_key,
        color_pref_light: (awayTeam as any)?.color_pref_light,
        color_pref_dark: (awayTeam as any)?.color_pref_dark,
      },
    }
  })
}

export default function ScoreboardPage() {
  // Season & Week defaulting
  const [season, setSeason] = useState<number>(() => currentSeasonForToday())
  const [week, setWeek] = useState<number>(() => currentNflWeek(currentSeasonForToday()))

  const [teamMap, setTeamMap] = useState<Record<string, TeamMapEntry>>({})
  const [games, setGames] = useState<GameCardData[]>([])
  const [msg, setMsg] = useState('')

  function flash(s: string) {
    setMsg(s)
    setTimeout(() => setMsg(''), 3000)
  }

  // (Re)compute default week if season changes manually
  useEffect(() => {
    // When user switches season, recompute a default “current week” for that season
    const w = currentNflWeek(season)
    setWeek(w)
  }, [season])

  // Bootstrap team map
  useEffect(() => {
    ;(async () => {
      try {
        const tm = await getJSON<any>('/api/team-map')
        const map: Record<string, TeamMapEntry> = Object.values<TeamMapEntry>(tm?.teams || {}).reduce(
          (acc, t: any) => {
            if (t?.id) acc[String(t.id)] = t
            if (t?.abbreviation) acc[String(t.abbreviation).toUpperCase()] = t
            return acc
          },
          {} as Record<string, TeamMapEntry>
        )
        setTeamMap(map)
      } catch (e: any) {
        flash(e?.message || 'Failed to load teams')
      }
    })()
  }, [])

  // Load games for selected week
  useEffect(() => {
    if (!season || !week) return
    ;(async () => {
      try {
        const j = await getJSON<any>(`/api/games-for-week?season=${season}&week=${week}`)
        const rows: RawGame[] = j?.games || j || []
        setGames(normalizeGames(rows, teamMap))
      } catch (e: any) {
        flash(e?.message || 'Failed to load games')
        setGames([])
      }
    })()
  }, [season, week, teamMap])

  const hasGames = games.length > 0

  // years to show: season-1 .. season+1
  const seasonOptions = useMemo(() => {
    const base = season
    return [base - 1, base, base + 1]
  }, [season])

  function prevWeek() {
    setWeek(w => (w > 1 ? w - 1 : 1))
  }
  function nextWeek() {
    setWeek(w => (w < 18 ? w + 1 : 18))
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Scoreboard</h1>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm">Season</label>
          <select
            className="border rounded px-2 py-1 bg-transparent"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
          >
            {seasonOptions.map(yr => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>

          <label className="text-sm ml-2">Week</label>
          <button
            className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700"
            onClick={prevWeek}
            disabled={week <= 1}
            aria-label="Previous week"
            title="Previous week"
          >
            ‹
          </button>
          <select
            className="border rounded px-2 py-1 bg-transparent"
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
          >
            {Array.from({ length: 18 }).map((_, i) => {
              const wk = i + 1
              return <option key={wk} value={wk}>{wk}</option>
            })}
          </select>
          <button
            className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700"
            onClick={nextWeek}
            disabled={week >= 18}
            aria-label="Next week"
            title="Next week"
          >
            ›
          </button>
        </div>
      </header>

      {msg ? <div className="mb-3 text-sm text-emerald-600">{msg}</div> : null}

      {!hasGames ? (
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
          <div className="text-sm text-neutral-600">No games for Week {week}.</div>
        </section>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </main>
  )
}
