// components/SpecialPicksCard.tsx
'use client'
import type { CSSProperties } from 'react'
import type { TeamShape } from '@/components/ui/TeamPill'

type Wrinkle = {
  id: string
  kind: string
  name?: string
  extra_picks?: number
  params?: { multiplier?: number; eligibleTeamIds?: string[] }
}

function Pill({
  label,
  logo,
  color,
  filled = false,
}: {
  label: string
  logo?: string | null
  color: string
  filled?: boolean
}) {
  const border = color || '#6b7280'
  const bg = filled ? color : 'transparent'
  const text = filled ? '#ffffff' : border
  return (
    <span
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold"
      style={{ borderColor: border, background: bg, color: text } as CSSProperties}
    >
      {logo ? <img src={logo} alt="" className="w-4 h-4 object-contain" /> : <span className="w-3 h-3 rounded-full" />}
      <span>{label}</span>
    </span>
  )
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
  const key = `${leagueId}:${season}:${week}`

  // Fetch active wrinkles for this slate
  const data = useWrinkles(leagueId, season, week)
  const wrinkles: Wrinkle[] = data?.wrinkles || []

  const winless = wrinkles.find((w) => String(w.kind).toLowerCase() === 'winless_double')
  const multiplier = winless?.params?.multiplier || 2
  const eligible = new Set(winless?.params?.eligibleTeamIds || [])

  const hasAny =
    wrinkles.length > 0 ||
    (typeof winless?.extra_picks === 'number' && winless.extra_picks > 0)

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

      {/* extra picks, if any */}
      {wrinkles.some((w) => (w.extra_picks || 0) > 0) && (
        <div className="mb-3 text-sm">
          {wrinkles
            .filter((w) => (w.extra_picks || 0) > 0)
            .map((w) => (
              <div key={w.id}>
                <strong>{w.name || 'Bonus'}</strong>: +{w.extra_picks} extra pick
                {w.extra_picks === 1 ? '' : 's'}
              </div>
            ))}
        </div>
      )}

      {/* Winless double */}
      {winless && (
        <div className="grid gap-2">
          <div className="text-sm">
            <strong>{winless.name || 'Winless Double'}</strong>: Pick a team with no wins yet — if they{' '}
            <em>win</em>, you get <strong>{multiplier}×</strong> their points.
          </div>

          {eligible.size === 0 ? (
            <div className="text-sm text-neutral-500">No eligible winless teams before Week {week}.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[...eligible].map((id) => {
                const t = teams[id] as any
                const abbr = (t?.abbreviation || '—') as string
                const color = (t?.color_primary || '#6b7280') as string
                const logo = (t?.logo || null) as string | null
                return <Pill key={id} label={abbr} logo={logo} color={color} />
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

import { useEffect, useState } from 'react'
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
    return () => {
      dead = true
    }
  }, [leagueId, season, week])
  return data
}
