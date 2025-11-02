// components/SpecialPicksCard.tsx
'use client'
import { useEffect, useState, useMemo } from 'react'
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

type WrinklePick = { id: string; wrinkle_id: string; team_id: string; game_id: string | null }

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

  const { picks, refresh: refreshPicks } = useWrinklePicks(leagueId, season, week)
  const pickByWrinkle = useMemo(() => {
    const m = new Map<string, WrinklePick>()
    for (const p of picks) m.set(p.wrinkle_id, p)
    return m
  }, [picks])

  const extraCount = wrinkles.reduce((acc, w) => acc + (w.extra_picks || 0), 0)
  const winless = wrinkles.find((w) => String(w.kind).toLowerCase() === 'winless_double')
  const multiplier = winless?.params?.multiplier || 2
  const winlessEligible = new Set(winless?.params?.eligibleTeamIds || [])

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

  const isLocked = (w: Wrinkle) => {
    const utc = w.game?.game_utc
    return utc ? new Date(utc) <= new Date() : false
  }

  async function chooseWrinkleTeam(w: Wrinkle, teamId: string) {
    try {
      const res = await fetch('/api/wrinkle-picks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          leagueId,
          season,
          week,
          wrinkleId: w.id,
          teamId,
          gameId: w.game?.game_id ?? null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || `HTTP ${res.status}`)
      }
      await refreshPicks()
    } catch (e) {
      console.error('wrinkle pick failed', e)
    }
  }

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

          <div className="flex flex-wrap gap-2">
            {[...winlessEligible].map((id) => {
              const t = teams[id]
              if (!t) return null
              const picked = pickByWrinkle.get(winless.id || '')
              const selected = picked?.team_id === id
              const locked = isLocked(winless)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => !locked && chooseWrinkleTeam(winless, id)}
                  className={[
                    'inline-flex rounded-full focus:outline-none',
                    selected ? 'ring-2 ring-neutral-400' : 'ring-0',
                    locked ? 'opacity-50 pointer-events-none' : 'active:scale-[0.98]',
                  ].join(' ')}
                  aria-pressed={selected}
                  title={selected ? 'Selected' : 'Select'}
                >
                  <TeamPill team={t} size="sm" className={selected ? 'font-bold' : ''} />
                </button>
              )
            })}
          </div>
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

          <div className="flex flex-wrap gap-2">
            {[...bonusEligible].map((id) => {
              const t = teams[id]
              if (!t) return null
              const picked = pickByWrinkle.get(bonusGame.id || '')
              const selected = picked?.team_id === id
              const locked = isLocked(bonusGame)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => !locked && chooseWrinkleTeam(bonusGame, id)}
                  className={[
                    'inline-flex rounded-full focus:outline-none',
                    selected ? 'ring-2 ring-neutral-400' : 'ring-0',
                    locked ? 'opacity-50 pointer-events-none' : 'active:scale-[0.98]',
                  ].join(' ')}
                  aria-pressed={selected}
                  title={selected ? 'Selected' : 'Select'}
                >
                  <TeamPill team={t} size="sm" className={selected ? 'font-bold' : ''} />
                </button>
              )
            })}
          </div>
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

function useWrinklePicks(leagueId: string, season: number, week: number) {
  const [picks, setPicks] = useState<WrinklePick[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const j = await fetch(`/api/wrinkle-picks?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' }).then(r => r.json())
      setPicks(Array.isArray(j?.picks) ? j.picks : [])
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'failed')
      setPicks([])
    }
  }

  useEffect(() => {
    if (!leagueId || !season || !week) return
    load()
  }, [leagueId, season, week])

  return { picks, refresh: load, error }
}
