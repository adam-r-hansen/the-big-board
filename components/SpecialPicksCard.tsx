'use client'

import { useEffect, useState } from 'react'
import TeamPill from '@/components/TeamPill'
import type { Team } from '@/types/domain'

type WrinkleGame = {
  id: string
  game_id: string
  game_utc: string
  home_team: string
  away_team: string
  spread: number | null
}

type Wrinkle = {
  id: string
  name: string
  kind?: string | null
  status: string
  season: number
  week: number
  extra_picks?: number | null
  games: WrinkleGame[]
}

type WrinklePick = {
  id: string
  wrinkle_id: string
  game_id: string
  team_id: string
}

type Props = {
  leagueId: string
  season: number
  week: number
  teams: Record<string, Team>
  isLocked: (gameUtc: string) => boolean
}

export default function SpecialPicksCard({ leagueId, season, week, teams, isLocked }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wrinkles, setWrinkles] = useState<Wrinkle[]>([])
  const [picksByWrinkle, setPicksByWrinkle] = useState<Record<string, WrinklePick[]>>({})
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/wrinkles/active?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' })
        if (!res.ok) {
          const j = await safeJson(res)
          throw new Error(j?.error || `load failed (${res.status})`)
        }
        const j = await res.json()
        if (!alive) return
        const list: Wrinkle[] = (j.wrinkles ?? []).map((w: any) => ({
          id: w.id,
          name: w.name,
          kind: w.kind ?? null,
          status: w.status ?? 'active',
          season: w.season,
          week: w.week,
          extra_picks: w.extra_picks ?? null,
          games: (w.games ?? []).map((g: any) => ({
            id: g.id,
            game_id: g.game_id,
            game_utc: g.game_utc,
            home_team: g.home_team,
            away_team: g.away_team,
            spread: g.spread ?? null,
          })),
        }))
        setWrinkles(list)

        const out: Record<string, WrinklePick[]> = {}
        for (const w of list) {
          const r = await fetch(`/api/wrinkles/${w.id}/picks`, { cache: 'no-store' })
          const pj = await safeJson(r)
          out[w.id] = (pj?.picks ?? []).map((p: any) => ({
            id: p.id, wrinkle_id: p.wrinkle_id ?? w.id, game_id: p.game_id, team_id: p.team_id,
          }))
        }
        if (alive) setPicksByWrinkle(out)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'load error')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [leagueId, season, week])

  const hasAnyWrinkles = wrinkles.some(w => w.games?.length)

  if (loading) {
    return (
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <header className="mb-3"><h2 className="text-base font-semibold">Special picks</h2></header>
        <div className="text-sm text-neutral-500">Loading…</div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <header className="mb-3"><h2 className="text-base font-semibold">Special picks</h2></header>
        <div className="text-sm text-red-600">{error}</div>
      </section>
    )
  }

  if (!hasAnyWrinkles) return null

  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Special picks</h2>
      </header>

      <div className="grid gap-4">
        {wrinkles.map(w => (
          <article key={w.id} className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
            <div className="mb-2 text-sm">
              <span className="font-semibold">{w.name}</span>
              {w.kind ? <span className="ml-2 text-neutral-500 uppercase text-[11px] tracking-wide">{w.kind}</span> : null}
            </div>

            {w.games.length === 0 ? (
              <div className="text-sm text-neutral-500">No games attached.</div>
            ) : (
              <ul className="grid gap-3">
                {w.games.map(g => {
                  const home = teams[g.home_team]
                  const away = teams[g.away_team]
                  const locked = isLocked(g.game_utc)
                  const current = (picksByWrinkle[w.id] ?? []).find(p => p.game_id === g.game_id)
                  const pickedTeamId = current?.team_id ?? null

                  return (
                    <li key={g.id} className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-2">
                      <div className="mb-1 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                        <span>{new Date(g.game_utc).toLocaleString()}</span>
                        <span className="uppercase tracking-wide">{locked ? 'LOCKED' : 'UPCOMING'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <TeamPill
                            team={home}
                            picked={pickedTeamId === home?.id}
                            disabled={locked || pending}
                            onClick={() => void toggle(w.id, g, home?.id || null)}
                          />
                        </div>
                        <div className="text-neutral-400">—</div>
                        <div className="flex-1">
                          <TeamPill
                            team={away}
                            picked={pickedTeamId === away?.id}
                            disabled={locked || pending}
                            onClick={() => void toggle(w.id, g, away?.id || null)}
                          />
                        </div>
                      </div>
                      {typeof g.spread === 'number' && (
                        <div className="mt-2 text-[11px] text-neutral-500">Spread: {g.spread}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  )

  async function safeJson(res: Response) {
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      try { return await res.json() } catch {}
    }
    return null
  }

  async function toggle(wrinkleId: string, g: WrinkleGame, teamId: string | null) {
    setError(null)
    setPending(true)
    try {
      const list = picksByWrinkle[wrinkleId] ?? []
      const existing = list.find(p => p.game_id === g.game_id)

      if (existing && existing.team_id === teamId) {
        const del = await fetch(`/api/wrinkles/${wrinkleId}/picks?id=${existing.id}`, { method: 'DELETE' })
        if (!del.ok) {
          const j = await safeJson(del)
          throw new Error(j?.error || 'unpick failed')
        }
      } else {
        if (existing) {
          const del = await fetch(`/api/wrinkles/${wrinkleId}/picks?id=${existing.id}`, { method: 'DELETE' })
          if (!del.ok) {
            const j = await safeJson(del)
            throw new Error(j?.error || 'swap-unpick failed')
          }
        }
        const res = await fetch(`/api/wrinkles/${wrinkleId}/picks`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ gameId: g.game_id, teamId }),
        })
        if (!res.ok) {
          const j = await safeJson(res)
          throw new Error(j?.error || 'pick failed')
        }
      }

      const r = await fetch(`/api/wrinkles/${wrinkleId}/picks`, { cache: 'no-store' })
      const pj = await safeJson(r)
      setPicksByWrinkle(prev => ({ ...prev, [wrinkleId]: (pj?.picks ?? []) }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'error')
    } finally {
      setPending(false)
    }
  }
}
