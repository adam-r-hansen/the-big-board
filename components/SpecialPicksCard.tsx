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
}

export default function SpecialPicksCard({ leagueId, season, week, teams }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wrinkle, setWrinkle] = useState<any | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        if (!leagueId || !season || !week) {
          setWrinkle(null)
          return
        }
        const url = `/api/wrinkles/active?leagueId=${encodeURIComponent(leagueId)}&season=${season}&week=${week}`
        const res = await fetch(url, { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
        if (!cancelled) setWrinkle(json?.wrinkle ?? null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [leagueId, season, week])

  // temporary no-op until we wire refresh behavior
  const handleChanged = () => {}

  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Wrinkle</h2>
      </header>

      {loading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600">load failed — {error}</div>
      ) : !wrinkle ? (
        <div className="text-sm text-neutral-500">No active wrinkle this week.</div>
      ) : (
        // Casts are intentional to satisfy WrinkleCard's current Props
        <WrinkleCard
          wrinkle={wrinkle as any}
          teams={teams}
          myPick={null as any}
          onChanged={handleChanged as any}
        />
      )}
    </section>
  )
}
