'use client'

import React, { useMemo } from 'react'
import { resolveTeamUi, type Team as TeamRecord } from '@/lib/teamColors'

type Size = 'sm' | 'md' | 'lg' | 'xl'
type Variant = 'pill' | 'chip' | 'subtle'        // allow 'subtle'
type LabelMode = 'abbr' | 'abbrNick' | 'full'

type Props = {
  /** New preferred shape */
  team?: TeamRecord
  /** Back-compat: pages can pass teamId + teamIndex */
  teamId?: string
  teamIndex?: Record<string, TeamRecord>

  size?: Size
  /** optional larger size applied at md+ (e.g. 'xl') */
  mdUpSize?: Size
  /** visual style */
  variant?: Variant
  /** label mode (abbr on mobile, full on desktop for abbrNick/full) */
  labelMode?: LabelMode
  /** force consistent width */
  fixedWidth?: boolean
  /** stretch to container width */
  fluid?: boolean
  /** bold border + light shadow */
  selected?: boolean
  /** disables pointer/click; dims pill */
  disabled?: boolean
  title?: string
  className?: string
  /** if present, we render a <button> */
  onClick?: React.MouseEventHandler<HTMLButtonElement>
}

export default function TeamPill({
  team,
  teamId,
  teamIndex,
  size = 'md',
  mdUpSize,
  variant = 'pill',
  labelMode = 'abbrNick',
  fixedWidth = false,
  fluid = false,
  selected = false,
  disabled = false,
  title,
  className = '',
  onClick,
}: Props) {
  const resolvedTeam = useMemo(
    () => team ?? (teamId && teamIndex ? teamIndex[teamId] : undefined),
    [team, teamId, teamIndex]
  )

  const ui = resolveTeamUi(resolvedTeam)
  const Component: any = onClick ? 'button' : 'span'

  const base =
    'inline-flex items-center justify-center rounded-xl border px-3 py-2 font-semibold overflow-hidden text-ellipsis whitespace-nowrap transition-[transform,box-shadow]'
  const heights: Record<Size, string> = {
    sm: 'h-9 text-xs',
    md: 'h-10 text-sm',
    lg: 'h-12 text-base',
    xl: 'h-14 text-lg',
  }
  const mdHeights = mdUpSize ? `md:${heights[mdUpSize]}` : ''
  const width = fluid ? 'w-full' : fixedWidth ? 'w-[7.5rem] md:w-[9.5rem]' : ''
  const border = selected ? 'border-2 shadow-sm' : 'border'
  const state = disabled ? 'opacity-60 pointer-events-none' : onClick ? 'cursor-pointer' : ''

  // Style mapping driven by Admin colors via resolveTeamUi
  const styles: React.CSSProperties = {
    borderColor: ui.primary,
    color: ui.primary,
  }

  // Variant visuals
  if (variant === 'pill') {
    styles.background = `linear-gradient(0deg, ${ui.secondary}14, transparent)` // ~8% tint
  } else if (variant === 'subtle') {
    styles.background = `linear-gradient(0deg, ${ui.secondary}0D, transparent)` // ~5% tint
  } // 'chip' => no background

  const abbr = resolvedTeam?.abbreviation || '—'
  const full = resolvedTeam?.name || abbr

  return (
    <Component
      type={onClick ? 'button' : undefined}
      title={title || full}
      className={[base, heights[size], mdHeights, width, border, state, className].join(' ')}
      style={styles}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
    >
      <span className="truncate max-w-full">
        {labelMode === 'full' ? (
          <>
            <span className="md:hidden">{abbr}</span>
            <span className="hidden md:inline">{full}</span>
          </>
        ) : labelMode === 'abbrNick' ? (
          <>
            <span className="md:hidden">{abbr}</span>
            <span className="hidden md:inline">{full}</span>
          </>
        ) : (
          <>{abbr}</>
        )}
      </span>
    </Component>
  )
}
