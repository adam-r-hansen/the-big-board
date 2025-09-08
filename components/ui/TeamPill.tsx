'use client'

import { useEffect, useMemo, useState } from 'react'
import type { TeamLike } from '@/lib/teamColors'
import { resolveTeamHex } from '@/lib/teamColors'

type Size = 'sm' | 'md' | 'lg' | 'xl'

type Props = {
  team?: TeamLike
  teamId?: string
  teamIndex?: Record<string, TeamLike>
  /** base size (mobile) */
  size?: Size
  /** upgrade size ≥ md */
  mdUpSize?: Size
  /** upgrade size ≥ lg */
  lgUpSize?: Size
  variant?: 'outline' | 'subtle'
  status?: 'LIVE' | 'FINAL' | 'UPCOMING'
  points?: number | null
  /**
   * label rendering:
   *  - 'abbr'        = "PHI"
   *  - 'short'       = "Eagles" or "Los Angeles Chargers" (whatever is in short_name)
   *  - 'name'        = full team name
   *  - 'abbrFull'    = "PHI" on mobile, short/name on md+ (responsive)
   *  - 'abbrNick'    = "PHI" on mobile, **nickname** (last word) on md+  ← recommended
   */
  labelMode?: 'abbr' | 'short' | 'name' | 'abbrFull' | 'abbrNick'
  className?: string
  /** makes border thicker */
  selected?: boolean
  disabled?: boolean
  /** force theme if needed */
  theme?: 'light' | 'dark'
}

function cls(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ')
}

/** Fixed, uniform dimensions per token (width is fixed; text truncates if too long) */
function dimsTokens(sz: Size): string[] {
  switch (sz) {
    case 'xl':
      return ['w-36', 'h-12', 'text-base']   // 144px
    case 'lg':
      return ['w-28', 'h-11', 'text-base']
    case 'sm':
      return ['w-16', 'h-8', 'text-xs']
    case 'md':
    default:
      return ['w-24', 'h-10', 'text-sm']
  }
}

function nicknameFrom(team?: TeamLike): string | undefined {
  if (!team) return undefined
  const src = team.short_name || team.name || team.abbreviation
  if (!src) return undefined
  const parts = String(src).trim().split(/\s+/)
  // If there's just one token (e.g., "Rams"), use it; else use last token (e.g., "Buccaneers")
  const nick = parts.length ? parts[parts.length - 1] : src
  return nick
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
    setDetectedTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
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
        background: variant === 'subtle'
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
