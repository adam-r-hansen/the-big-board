'use client'

import { useEffect, useState } from 'react'
import WrinkleCard from '@/components/WrinkleCard'
import type { Team as DomainTeam } from '@/types/domain'

type Props = {
  leagueId: string
  season: number
  week: number
  teams: Record<string, DomainTeam>
}

type APIWrinkleGame = {
  id: string
  game_id: string
  home_team: string
  away_team: string
  game_utc: string
  spread?: number | null
}

type APIWrinkle = {
  id: string
  name: string
  kind: 'bonus' | 'spread' | 'oof' | 'winless_double'
  status: 'active' | 'draft' | 'archived'
  season: number
  week: number
  extraPicks?: number | null
  games?: APIWrinkleGame[]
}

export default function SpecialPicksCard({
  leagueId,
  season,
  week,
  teams,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [wrinkle, setWrinkle] = useState<APIWrinkle | null>(null)

  useEffect(() => {
    let abort = false
    setLoading(true)
    setError(null)
    setWrinkle(null)

    const url =
      `/api/wrinkles/active?leagueId=${encodeURIComponent(leagueId)}&season=${season}&week=${week}`

    fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          let msg = `${res.status}`
          try { msg = await res.text() } catch {}
          throw new Error(msg)
        }
        return res.json()
      })
      .then((payload: APIWrinkle[] | { wrinkles?: APIWrinkle[] }) => {
        if (abort) return
        const list = Array.isArray(payload) ? payload : (payload?.wrinkles ?? [])
        const chosen =
          list.find((w) => w.kind === 'bonus') ??
          list[0] ??
          null
        setWrinkle(chosen)
      })
      .catch((e: any) => {
        if (!abort) setError(String(e?.message ?? e))
      })
      .finally(() => {
        if (!abort) setLoading(false)
      })

    return () => {
      abort = true
    }
  }, [leagueId, season, week])

  // Prepare the cast outside of JSX to keep the parser happy.
  const wrinkleForCard = (wrinkle ?? undefined) as unknown as any

  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <header className="mb-3">
        <h2 className="text-base font-semibold">Wrinkles</h2>
      </header>

      {loading && <div className="text-sm text-neutral-500">Loading…</div>}

      {!loading && error && (
        <div className="text-sm text-red-600">load failed — {error}</div>
      )}

      {!loading && !error && !wrinkle && (
        <div className="text-sm text-neutral-500">No linked game.</div>
      )}

      {!loading && !error && wrinkle && (
        <WrinkleCard wrinkle={wrinkleForCard} teams={teams} />
      )}
    </section>
  )
}

