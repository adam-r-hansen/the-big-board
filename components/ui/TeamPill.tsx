'use client'

import { useEffect, useMemo, useState } from 'react'
import type { TeamLike } from '@/lib/teamColors'
import { resolveTeamHex } from '@/lib/teamColors'

type Size = 'sm' | 'md' | 'lg' | 'xl'

type Props = {
  team?: TeamLike
  teamId?: string
  teamIndex?: Record<string, TeamLike>
  size?: Size            // base size (mobile)
  mdUpSize?: Size        // ≥ md override
  lgUpSize?: Size        // ≥ lg override
  variant?: 'outline' | 'subtle'
  status?: 'LIVE' | 'FINAL' | 'UPCOMING'
  points?: number | null
  /**
   * label rendering:
   *  - 'abbr'        = "PHI"
   *  - 'short'       = "Los Angeles Chargers" (whatever short_name is)
   *  - 'name'        = full team name
   *  - 'abbrFull'    = "PHI" on mobile, short/name on md+
   *  - 'abbrNick'    = "PHI" on mobile, **nickname** (last word) on md+  ← recommended
   */
  labelMode?: 'abbr' | 'short' | 'name' | 'abbrFull' | 'abbrNick'
  className?: string
  selected?: boolean
  disabled?: boolean
  theme?: 'light' | 'dark'
}

function cls(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ')
}

/** Fixed, UNIFORM widths. Wider on larger tokens. */
function dimsTokens(sz: Size): string[] {
  switch (sz) {
    case 'xl':
      // 192px wide — scoreboard pills on desktop
      return ['w-48', 'h-12', 'text-base']
    case 'lg':
      // 144px — My Picks pills on desktop
      return ['w-36', 'h-11', 'text-base']
    case 'md':
      // 112px
      return ['w-28', 'h-10', 'text-sm']
    case 'sm':
    default:
      // 80px — compact mobile
      return ['w-20', 'h-8', 'text-xs']
  }
}

function nicknameFrom(team?: TeamLike): string | undefined {
  if (!team) return undefined
  const src = team.short_name || team.name || team.abbreviation
  if (!src) return undefined
  const parts = String(src).trim().split(/\s+/)
  return parts.length ? parts[parts.length - 1] : src
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
    setDetectedTheme(
      document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    )
  }, [theme])
  const t = theme || detectedTheme

  const resolvedTeam = useMemo(() => {
    if (team) return team
    if (!teamId) return undefined
    return teamIndex?.[teamId] || teamIndex?.[String(teamId).toUpperCase()]
  }, [team, teamId, teamIndex])

  const color = resolveTeamHex(resolvedTeam, t)

  // uniform dimensions with breakpoint upgrades
  const base = dimsTokens(size)
  const mdUp = mdUpSize ? dimsTokens(mdUpSize).map(c => `md:${c}`) : []
  const lgUp = lgUpSize ? dimsTokens(lgUpSize).map(c => `lg:${c}`) : []
  const dims = [...base, ...mdUp, ...lgUp].join(' ')

  const shell =
    'inline-flex items-center justify-center gap-1 rounded-xl font-semibold overflow-hidden text-ellipsis whitespace-nowrap'
  const border = selected ? 'border-2' : 'border'
  const cursor = disabled ? 'opacity-60 cursor-not-allowed' : ''

  // Build label
  const labelNode = useMemo(() => {
    const rt = resolvedTeam
    const abbr = (rt?.abbreviation || '—').toUpperCase()
    const short = rt?.short_name || rt?.name || abbr
    const full = rt?.name || short
    const nick = nicknameFrom(rt) || abbr

    switch (labelMode) {
      case 'name':
        return <span className="truncate max-w-full">{full}</span>
      case 'short':
        return <span className="truncate max-w-full">{short}</span>
      case 'abbrFull':
        return (
          <span className="truncate max-w-full">
            <span className="md:hidden">{abbr}</span>
            <span className="hidden md:inline">{short}</span>
          </span>
        )
      case 'abbrNick':
        return (
          <span className="truncate max-w-full">
            <span className="md:hidden">{abbr}</span>
            <span className="hidden md:inline">{nick}</span>
          </span>
        )
      case 'abbr':
      default:
        return <span className="truncate max-w-full">{abbr}</span>
    }
  }, [resolvedTeam, labelMode])

  const title =
    (resolvedTeam?.name || resolvedTeam?.short_name || resolvedTeam?.abbreviation) || undefined

  return (
    <span
      className={cls(shell, border, dims, cursor, className)}
      style={{
        borderColor: color,
        color,
        background:
          variant === 'subtle'
            ? `color-mix(in srgb, ${color} 12%, transparent)`
            : 'transparent',
      }}
      title={title}
      aria-pressed={selected || undefined}
    >
      {labelNode}
      {status === 'LIVE' && <span className="text-[10px]">• LIVE</span>}
      {status === 'FINAL' && typeof points === 'number' && (
        <span className="text-[10px]">{points >= 0 ? `+${points}` : `${points}`}</span>
      )}
    </span>
  )
}
