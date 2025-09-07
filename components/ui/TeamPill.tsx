'use client'

import { useEffect, useMemo, useState } from 'react'
import type { TeamLike } from '@/lib/teamColors'
import { resolveTeamHex } from '@/lib/teamColors'

type Props = {
  team?: TeamLike
  teamId?: string
  teamIndex?: Record<string, TeamLike>
  size?: 'sm' | 'md' | 'lg'
  variant?: 'outline' | 'subtle'
  status?: 'LIVE' | 'FINAL' | 'UPCOMING'
  points?: number | null
  labelMode?: 'abbr' | 'short' | 'name'
  className?: string
  selected?: boolean
  disabled?: boolean
  /** Optional: force theme; otherwise detects from document root .dark */
  theme?: 'light' | 'dark'
}

function cls(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ')
}

export default function TeamPill({
  team, teamId, teamIndex,
  size = 'md',
  variant = 'outline',
  status,
  points = null,
  labelMode = 'abbr',
  className,
  selected = false,
  disabled = false,
  theme,
}: Props) {

  // Detect theme if not provided
  const [detectedTheme, setDetectedTheme] = useState<'light'|'dark'>('light')
  useEffect(() => {
    if (theme) return
    if (typeof window === 'undefined') return
    const el = document?.documentElement
    const isDark = el?.classList?.contains('dark')
    setDetectedTheme(isDark ? 'dark' : 'light')
  }, [theme])
  const t = theme || detectedTheme

  const resolvedTeam = useMemo(() => {
    if (team) return team
    if (!teamId) return undefined
    return teamIndex?.[teamId] || teamIndex?.[teamId.toUpperCase()]
  }, [team, teamId, teamIndex])

  const color = resolveTeamHex(resolvedTeam, t)

  // Uniform dimensions
  const dims =
    size === 'lg' ? 'w-24 h-11 text-base' :
    size === 'sm' ? 'w-16 h-8 text-xs' :
    'w-20 h-9 text-sm'

  const base = 'inline-flex items-center justify-center gap-1 rounded-xl font-semibold overflow-hidden text-ellipsis whitespace-nowrap'
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
      className={cls(base, border, dims, cursor, className)}
      style={{
        borderColor: color,
        color: color,
        background: variant === 'subtle' ? `color-mix(in srgb, ${color} 12%, transparent)` : 'transparent',
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
