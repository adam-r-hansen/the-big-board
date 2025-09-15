'use client'

import * as React from 'react'

export type TeamShape = {
  id: string
  abbreviation?: string | null
  name?: string | null
  color_primary?: string | null
  color_secondary?: string | null
  color_tertiary?: string | null
  color_quaternary?: string | null
  ui_light_color_key?: string | null
  ui_dark_color_key?: string | null
}

type Size = 'sm' | 'md' | 'lg'
type LabelMode = 'abbr' | 'name' | 'none'

export function pickTeamColor(team?: TeamShape | null, mode: 'light' | 'dark'): string {
  if (!team) return '#e5e7eb'
  const key =
    mode === 'light'
      ? (team.ui_light_color_key as keyof TeamShape) || 'color_primary'
      : (team.ui_dark_color_key as keyof TeamShape) || 'color_secondary'

  const hex = (team as any)?.[key]
  if (typeof hex === 'string' && /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(hex)) return hex

  const fallbacks =
    mode === 'light'
      ? [team.color_primary, team.color_secondary, '#e5e7eb']
      : [team.color_secondary, team.color_primary, '#111827']
  return (fallbacks.find((c) => typeof c === 'string') as string) || '#e5e7eb'
}

function textColorFor(bgHex: string): string {
  try {
    const h = bgHex.replace('#', '')
    const r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16)
    const g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16)
    const b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16)
    const L = 0.299 * r + 0.587 * g + 0.114 * b
    return L > 160 ? '#111827' : '#ffffff'
  } catch {
    return '#111827'
  }
}

const sizeClasses: Record<Size, string> = {
  sm: 'text-xs px-2.5 py-1 rounded-full',
  md: 'text-sm px-3.5 py-1.5 rounded-full',
  lg: 'text-base px-4.5 py-2 rounded-full',
}

export function TeamPill({
  team,
  mode = 'light',
  size = 'md',
  label = 'abbr',
  children,
  className = '',
}: {
  team: TeamShape
  mode?: 'light' | 'dark'
  size?: Size
  label?: LabelMode
  children?: React.ReactNode
  className?: string
}) {
  const bg = pickTeamColor(team, mode)
  const fg = textColorFor(bg)

  const content =
    typeof children !== 'undefined'
      ? children
      : label === 'none'
      ? null
      : label === 'name'
      ? team?.name || team?.abbreviation || '—'
      : team?.abbreviation || team?.name || '—'

  return (
    <span
      className={[
        'inline-flex items-center justify-center font-semibold border shadow-sm select-none',
        sizeClasses[size],
        className,
      ].join(' ')}
      style={{
        background: bg,   // single, mono color fill
        color: fg,
        borderColor: 'rgba(0,0,0,0.18)',
      }}
    >
      {content}
    </span>
  )
}

export default TeamPill
