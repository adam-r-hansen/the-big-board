'use client'

import { useEffect, useMemo, useState } from 'react'
import type { TeamLike } from '@/lib/teamColors'
import { resolveTeamHex } from '@/lib/teamColors'

type Size = 'sm' | 'md' | 'lg' | 'xl'

type Props = {
  team?: TeamLike
  teamId?: string
  teamIndex?: Record<string, TeamLike>
  size?: Size                 // base (mobile)
  mdUpSize?: Size             // ≥ md breakpoint
  lgUpSize?: Size             // ≥ lg breakpoint
  variant?: 'outline' | 'subtle'
  status?: 'LIVE' | 'FINAL' | 'UPCOMING'
  points?: number | null
  labelMode?: 'abbr' | 'short' | 'name'
  className?: string
  selected?: boolean
  disabled?: boolean
  theme?: 'light' | 'dark'
}

function cls(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ')
}

function dimsTokens(sz: Size): string[] {
  switch (sz) {
    case 'xl':
      return ['w-32', 'h-12', 'text-base']    // NEW: very clear desktop size
    case 'lg':
      return ['w-28', 'h-11', 'text-base']    // bumped up from previous
    case 'sm':
      return ['w-16', 'h-8', 'text-xs']
    case 'md':
    default:
      return ['w-20', 'h-9', 'text-sm']
  }
}

export default function TeamPill({
  team, teamId, teamIndex,
  size = 'sm',
  mdUpSize,
  lgUpSize,
  variant = 'outline',
  status,
  points = null,
  labelMode = 'abbr',
  className,
  selected = false,
  disabled = false,
  theme,
}: Props) {
  // detect theme if not provided
  const [detectedTheme, setDetectedTheme] = useState<'light'|'dark'>('light')
  useEffect(() => {
    if (theme) return
    if (typeof window === 'undefined') return
    const isDark = document.documentElement.classList.contains('dark')
    setDetectedTheme(isDark ? 'dark' : 'light')
  }, [theme])
  const t = theme || detectedTheme

  const resolvedTeam = useMemo(() => {
    if (team) return team
    if (!teamId) return undefined
    return teamIndex?.[teamId] || teamIndex?.[teamId.toUpperCase()]
  }, [team, teamId, teamIndex])

  const color = resolveTeamHex(resolvedTeam, t)

  // uniform dimensions with breakpoint upgrades
  const base = dimsTokens(size)
  const mdUp = mdUpSize ? dimsTokens(mdUpSize).map(c => `md:${c}`) : []
  const lgUp = lgUpSize ? dimsTokens(lgUpSize).map(c => `lg:${c}`) : []
  const dims = [...base, ...mdUp, ...lgUp].join(' ')

  const shell = 'inline-flex items-center justify-center gap-1 rounded-xl font-semibold overflow-hidden text-ellipsis whitespace-nowrap'
  const border = selected ? 'border-2' : 'border'
  const cursor = disabled ? 'opacity-60 cursor-not-allowed' : ''

  const label = useMemo(() => {
    const rt = resolvedTeam
    if (!rt) return '—'
    if (labelMode === 'name') return rt.name || rt.short_name || rt.abbreviation || '—'
    if (labelMode === 'short') return rt.short_name || rt.name || rt.abbreviation || '—'
    return (rt.abbreviation || '—').toUpperCase()
  }, [resolvedTeam, labelMode])

  return (
    <span
      className={cls(shell, border, dims, cursor, className)}
      style={{
        borderColor: color,
        color: color,
        background: variant === 'subtle'
          ? `color-mix(in srgb, ${color} 12%, transparent)`
          : 'transparent',
      }}
      title={status || undefined}
      aria-pressed={selected || undefined}
    >
      <span className="truncate max-w-full">{label}</span>
      {status === 'LIVE' && <span className="text-[10px]">• LIVE</span>}
      {status === 'FINAL' && typeof points === 'number' && (
        <span className="text-[10px]">{points >= 0 ? `+${points}` : `${points}`}</span>
      )}
    </span>
  )
}
