// components/OOFPicksCard.tsx
'use client'
import { useEffect, useState } from 'react'
import TeamCard from '@/components/TeamCard'

type Team = {
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

type WrinkleGame = {
  id: string
  game_id: string
  game_utc: string
  home_team: string
  away_team: string
}

type Wrinkle = {
  id: string
  name: string
  season: number
  week: number
  extra_picks?: number
}

type Pick = {
  id: string
  team_id: string
  game_id: string
}

type Props = {
  leagueId: string
  season: number
  week: number
  teams: Record<string, Team>
}

export default function OOFPicksCard({ leagueId, season, week, teams }: Props) {
  const [loading, setLoading] = useState(false)
  const [wrinkle, setWrinkle] = useState<Wrinkle | null>(null)
  const [games, setGames] = useState<WrinkleGame[]>([])
  const [myPick, setMyPick] = useState<Pick | null>(null)
  const [teamRecords, setTeamRecords] = useState<Record<string, number>>({})
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!leagueId || !season || !week) return
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        // Get active OOF wrinkle
        const wRes = await fetch(`/api/wrinkles/active?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' })
        const wData = await wRes.json().catch(() => ({}))
        const wrinkles = Array.isArray(wData?.wrinkles) ? wData.wrinkles : []
        const oofWrinkle = wrinkles.find((w: any) => w.kind === 'bonus_game_oof')
        
        if (!oofWrinkle) {
          setWrinkle(null)
          setGames([])
          setMyPick(null)
          setLoading(false)
          return
        }

        setWrinkle(oofWrinkle)

        // Get wrinkle games
        const gRes = await fetch(`/api/wrinkles/${oofWrinkle.id}/games`, { cache: 'no-store' })
        const gData = await gRes.json().catch(() => ({}))
        setGames(Array.isArray(gData?.games) ? gData.games : [])

        // Get my pick
        const pRes = await fetch(`/api/wrinkles/${oofWrinkle.id}/picks`, { cache: 'no-store' })
        const pData = await pRes.json().catch(() => ({}))
        const picks = Array.isArray(pData?.picks) ? pData.picks : []
        setMyPick(picks[0] || null)

        // Get team records from previous week
        const recordsWeek = week - 1
        const rRes = await fetch(`/api/team-records?season=${season}&week=${recordsWeek}`, { cache: 'no-store' })
        const rData = await rRes.json().catch(() => ({}))
        const records: Record<string, number> = {}
        if (Array.isArray(rData?.records)) {
          for (const r of rData.records) {
            if (r.team_id && r.win_pct != null) {
              records[r.team_id] = Number(r.win_pct)
            }
          }
        }
        setTeamRecords(records)
      } catch (e: any) {
        setErr(e?.message || 'Failed to load OOF picks')
      } finally {
        setLoading(false)
      }
    })()
  }, [leagueId, season, week])

  const isLocked = (utc: string) => new Date(utc) <= new Date()

  async function pick(teamId: string, gameId: string) {
    if (!wrinkle) return
    try {
      const res = await fetch(`/api/wrinkles/${wrinkle.id}/picks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ teamId, gameId }),
        cache: 'no-store',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || 'Pick failed')
      }
      // Refresh pick
      const pRes = await fetch(`/api/wrinkles/${wrinkle.id}/picks`, { cache: 'no-store' })
      const pData = await pRes.json().catch(() => ({}))
      const picks = Array.isArray(pData?.picks) ? pData.picks : []
      setMyPick(picks[0] || null)
      setErr(null)
    } catch (e: any) {
      setErr(e?.message || 'Pick failed')
    }
  }

  async function unpick() {
    if (!wrinkle || !myPick) return
    try {
      const res = await fetch(`/api/wrinkles/${wrinkle.id}/picks?id=${myPick.id}`, {
        method: 'DELETE',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Unpick failed')
      setMyPick(null)
      setErr(null)
    } catch (e: any) {
      setErr(e?.message || 'Unpick failed')
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
        <h2 className="text-lg font-semibold mb-3">OOF Bonus Pick</h2>
        <div className="text-sm text-neutral-500">Loading...</div>
      </section>
    )
  }

  if (!wrinkle) return null

  return (
    <section className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-900/10 p-4 md:p-5">
      <header className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center rounded-full border border-amber-300/60 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            OOF Bonus
          </span>
          <h2 className="text-lg font-semibold">{wrinkle.name}</h2>
        </div>
        <p className="text-xs text-amber-900/70 dark:text-amber-200/80">
          Pick one team with win % below .400 • Using Week {week - 1} records
          {wrinkle.extra_picks ? ` • +${wrinkle.extra_picks} extra pick${wrinkle.extra_picks > 1 ? 's' : ''}` : ''}
        </p>
      </header>

      {games.length === 0 && (
        <div className="text-sm text-neutral-500">No qualifying games this week</div>
      )}

      <div className="space-y-3">
        {games.map((game) => {
          const homeTeam = teams[game.home_team]
          const awayTeam = teams[game.away_team]
          const locked = isLocked(game.game_utc)
          
          const homeWinPct = teamRecords[game.home_team] ?? 1.0
          const awayWinPct = teamRecords[game.away_team] ?? 1.0
          const homeEligible = homeWinPct < 0.400
          const awayEligible = awayWinPct < 0.400

          const homePicked = myPick?.team_id === game.home_team
          const awayPicked = myPick?.team_id === game.away_team

          const homeVariant = homeEligible ? (homePicked ? 'solid' : 'hollow') : 'greyscale'
          const awayVariant = awayEligible ? (awayPicked ? 'solid' : 'hollow') : 'greyscale'

          return (
            <article key={game.id} className="rounded-xl border border-amber-200/60 dark:border-amber-900/60 bg-white dark:bg-neutral-900 p-3">
              <div className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
                {new Date(game.game_utc).toLocaleString()}
                {locked && <span className="ml-2 text-amber-700 dark:text-amber-300">• LOCKED</span>}
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  {awayTeam && (
                    <TeamCard
                      team={{
                        id: awayTeam.id,
                        name: awayTeam.name,
                        short_name: awayTeam.short_name || awayTeam.name,
                        abbreviation: awayTeam.abbreviation,
                        logo: awayTeam.logo,
                        color_primary: awayTeam.color_primary,
                        color_secondary: awayTeam.color_secondary,
                        color_pref_light: awayTeam.color_pref_light,
                        color_pref_dark: awayTeam.color_pref_dark,
                      }}
                      variant={awayVariant}
                      displayText="short"
                      onClick={() => awayEligible && !locked && pick(game.away_team, game.game_id)}
                      disabled={!awayEligible || locked}
                    />
                  )}
                </div>
                
                <div className="text-neutral-400 font-semibold">@</div>
                
                <div className="flex-1">
                  {homeTeam && (
                    <TeamCard
                      team={{
                        id: homeTeam.id,
                        name: homeTeam.name,
                        short_name: homeTeam.short_name || homeTeam.name,
                        abbreviation: homeTeam.abbreviation,
                        logo: homeTeam.logo,
                        color_primary: homeTeam.color_primary,
                        color_secondary: homeTeam.color_secondary,
                        color_pref_light: homeTeam.color_pref_light,
                        color_pref_dark: homeTeam.color_pref_dark,
                      }}
                      variant={homeVariant}
                      displayText="short"
                      onClick={() => homeEligible && !locked && pick(game.home_team, game.game_id)}
                      disabled={!homeEligible || locked}
                    />
                  )}
                </div>
              </div>

              {/* Show eligibility info */}
              <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                {homeEligible && awayEligible && '✓ Both teams eligible'}
                {homeEligible && !awayEligible && `✓ ${homeTeam?.abbreviation} eligible`}
                {!homeEligible && awayEligible && `✓ ${awayTeam?.abbreviation} eligible`}
              </div>
            </article>
          )
        })}
      </div>

      {myPick && !games.some(g => isLocked(g.game_utc)) && (
        <div className="mt-3 pt-3 border-t border-amber-200/60 dark:border-amber-900/60">
          <button
            type="button"
            className="text-xs text-amber-900 dark:text-amber-200 underline"
            onClick={unpick}
          >
            Unpick
          </button>
        </div>
      )}

      {err && (
        <div className="mt-3 text-xs text-red-600 dark:text-red-400">{err}</div>
      )}
    </section>
  )
}
