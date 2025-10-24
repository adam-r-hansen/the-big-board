// components/SpecialPicksCard.tsx
'use client'
import { useEffect, useState } from 'react'
import TeamPill, { type TeamShape } from '@/components/ui/TeamPill'

type Wrinkle = {
  id: string
  kind: string
  name?: string
  extra_picks?: number
  params?: { multiplier?: number; eligibleTeamIds?: string[] }
  game?: {
    game_id?: string | null
    game_utc?: string | null
    status?: string | null
    home_team?: string | null
    away_team?: string | null
  }
}

export default function SpecialPicksCard({
  leagueId,
  season,
  week,
  teams,
}: {
  leagueId: string
  season: number
  week: number
  teams: Record<string, TeamShape>
}) {
  const data = useWrinkles(leagueId, season, week)
  const wrinkles: Wrinkle[] = data?.wrinkles || []

  // Extract common pieces
  const extraCount = wrinkles.reduce((acc, w) => acc + (w.extra_picks || 0), 0)
  const winless = wrinkles.find((w) => String(w.kind).toLowerCase() === 'winless_double')
  const multiplier = winless?.params?.multiplier || 2
  const winlessEligible = new Set(winless?.params?.eligibleTeamIds || [])

  // bonus_game: eligible teams are home/away of the attached wrinkle game
  const bonusGame = wrinkles.find((w) => String(w.kind).toLowerCase() === 'bonus_game')
  const bonusEligible = new Set<string>()
  if (bonusGame?.game) {
    if (bonusGame.game.home_team) bonusEligible.add(bonusGame.game.home_team)
    if (bonusGame.game.away_team) bonusEligible.add(bonusGame.game.away_team)
  }

  const hasAny =
    wrinkles.length > 0 ||
    extraCount > 0 ||
    winlessEligible.size > 0 ||
    bonusEligible.size > 0

  if (!hasAny) {
    return (
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
        <h2 className="text-lg font-semibold mb-1">Wrinkle pick</h2>
        <div className="text-sm text-neutral-500">No active wrinkle</div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
      <header className="mb-2">
        <h2 className="text-lg font-semibold">Wrinkle pick</h2>
      </header>

      {/* Extra picks, if any */}
      {extraCount > 0 && (
        <div className="mb-3 text-sm">
          <strong>Bonus picks</strong>: +{extraCount} extra pick{extraCount === 1 ? '' : 's'}
        </div>
      )}

      {/* Winless double rule */}
      {winless && (
        <div className="grid gap-2 mb-3">
          <div className="text-sm">
            <strong>{winless.name || 'Winless Double'}</strong>: Pick a team with no wins yet — if they <em>win</em>, you get{' '}
            <strong>{multiplier}×</strong> their points.
          </div>

          {winlessEligible.size === 0 ? (
            <div className="text-sm text-neutral-500">No eligible winless teams before Week {week}.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[...winlessEligible].map((id) => {
                const t = teams[id]
                if (!t) return null
                return (
                  <TeamPill
                    key={id}
                    team={t}
                    size="sm"
                    className="pointer-events-none opacity-90"
                    aria-disabled="true"
                  />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Bonus game rule (Opening Night, etc.) */}
      {bonusGame && (
        <div className="grid gap-2">
          <div className="text-sm">
            <strong>{bonusGame.name || 'Bonus Game'}</strong>: One extra pick on this featured matchup.
            {bonusGame.game?.game_utc ? (
              <span className="opacity-70"> Kickoff: {new Date(bonusGame.game.game_utc).toLocaleString()}</span>
            ) : null}
          </div>

          {bonusEligible.size === 0 ? (
            <div className="text-sm text-neutral-500">Eligible teams not available.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[...bonusEligible].map((id) => {
                const t = teams[id]
                if (!t) return null
                return (
                  <TeamPill
                    key={id}
                    team={t}
                    size="sm"
                    className="pointer-events-none opacity-90"
                    aria-disabled="true"
                  />
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function useWrinkles(leagueId: string, season: number, week: number) {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    if (!leagueId || !season || !week) return
    let dead = false
    ;(async () => {
      try {
        const j = await fetch(`/api/wrinkles/active?leagueId=${leagueId}&season=${season}&week=${week}`, {
          cache: 'no-store',
        }).then((r) => r.json())
        if (!dead) setData(j)
      } catch {
        if (!dead) setData(null)
      }
    })()
    return () => { dead = true }
  }, [leagueId, season, week])
  return data
}
