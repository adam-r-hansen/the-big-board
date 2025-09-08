// components/TeamPill.tsx
'use client'
import * as React from 'react'
import { resolveTeamUi, type TeamRecord } from '@/lib/teamColors'

type Size = 'sm' | 'md' | 'lg'

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 md:h-12 md:px-6 text-sm md:text-base',
  lg: 'h-12 px-5 md:h-14 md:px-7 text-base md:text-lg',
}

/**
 * TeamPill
 * - Uniform size
 * - Abbr on mobile, full on md+
 * - Heavier border when selected
 */
export function TeamPill({
  team,
  size = 'md',
  selected = false,
  className = '',
  title,
}: {
  team?: TeamRecord
  size?: Size
  selected?: boolean
  className?: string
  title?: string
}) {
  const { primary, secondary } = resolveTeamUi(team)
  const abbr = team?.abbreviation || '—'
  const full = team?.name || team?.short_name || abbr

  return (
    <span
      title={title || full}
      className={[
        'inline-flex items-center justify-center rounded-2xl border font-semibold whitespace-nowrap truncate w-full md:w-64',
        sizeClasses[size],
        selected ? 'ring-2 ring-offset-0' : '',
        className,
      ].join(' ')}
      style={{
        borderColor: primary,
        color: primary,
        background: `${secondary}10`,
        boxShadow: selected ? `0 0 0 2px ${primary} inset` : undefined,
      }}
    >
      <span className="truncate max-w-full">
        <span className="md:hidden">{abbr}</span>
        <span className="hidden md:inline">{full}</span>
      </span>
    </span>
  )
}

/**
 * TeamBadge — compact variant for lists / sidebars
 * Supports optional status/points badge.
 */
export function TeamBadge({
  team,
  status,
  points,
  className = '',
}: {
  team?: TeamRecord
  status?: string
  points?: number | null
  className?: string
}) {
  const { primary, secondary } = resolveTeamUi(team)
  const abbr = team?.abbreviation || '—'
  const full = team?.name || team?.short_name || abbr
  const s = (status || '').toUpperCase()
  const badge =
    s === 'FINAL' ? (typeof points === 'number' ? `+${points}` : '') : s === 'LIVE' ? '• LIVE' : ''

  return (
    <span
      title={full}
      className={[
        'inline-flex items-center gap-2 rounded-2xl border font-semibold whitespace-nowrap truncate px-3 h-9 md:h-10',
        className,
      ].join(' ')}
      style={{ borderColor: primary, color: primary, background: `${secondary}10` }}
    >
      <span className="truncate">
        <span className="md:hidden">{abbr}</span>
        <span className="hidden md:inline">{full}</span>
      </span>
      {badge ? <span className="text-xs opacity-80">{badge}</span> : null}
    </span>
  )
}
