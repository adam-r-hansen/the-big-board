// components/SpecialPicksCard.tsx
'use client'

import { useEffect, useState } from 'react'
import WrinkleCard from '@/components/WrinkleCard'
import type { Team } from '@/types/domain'

type Props = {
  leagueId: string
  season: number
  week: number
  teams: Record<string, Team>
  // accepted to match caller; not used here
  isLocked?: (gameUtc: string) => boolean
}

type ActiveWrinkleResponse = {
  wrinkles?: any[]
  error?: string
}

export default function SpecialPicksCard({ leagueId, season, week, teams }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wrinkle, setWrinkle] = useState<any | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!leagueId) return

    setLoading(true)
    setError(null)

    fetch(`/api/wrinkles/active?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          try {
            const j = (await res.json()) as ActiveWrinkleResponse
            throw new Error(j?.error || `HTTP ${res.status}`)
          } catch {
            throw new Error(`HTTP ${res.status}`)
          }
        }
        return (await res.json()) as ActiveWrinkleResponse
      })
      .then((j) => {
        if (cancelled) return
        const first = Array.isArray(j?.wrinkles) && j.wrinkles.length ? j.wrinkles[0] : null
        setWrinkle(first)
      })
      .catch((e: any) => {
        if (cancelled) return
        setError(e?.message || 'load error')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [leagueId, season, week])

  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Wrinkles</h2>
      </header>

      {loading && <div className="text-sm text-neutral-500">Loading…</div>}

      {!loading && error && (
        <div className="text-sm text-red-600">
          load failed — {error}
        </div>
      )}

      {!loading && !error && !wrinkle && (
        <div className="text-sm text-neutral-500">No active wrinkles this week.</div>
      )}

      {!loading && !error && wrinkle && (
        {/* Cast for now; WrinkleCard owns rendering/behavior */}
        <WrinkleCard wrinkle={wrinkle as any} teams={teams} />
      )}
    </section>
  )
}
