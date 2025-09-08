'use client'

import React from 'react'
import { resolveTeamUi, type Team as TeamRecord } from '@/lib/teamColors'

type Size = 'sm' | 'md' | 'lg' | 'xl'
type Variant = 'pill' | 'chip'
type LabelMode = 'abbr' | 'abbrNick' | 'full'

type Props = {
  team?: TeamRecord
  size?: Size
  /** optional larger size applied at md+ (e.g. 'xl') */
  mdUpSize?: Size
  /** visual style; keep default 'pill' */
  variant?: Variant
  /** how to label: abbr on mobile, full name desktop for 'abbrNick' & 'full' */
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
  /** optional click handler (when present we render a <button>) */
  onClick?: React.MouseEventHandler<HTMLButtonElement>
}

export default function TeamPill({
  team,
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
  const ui = resolveTeamUi(team)

  // When clickable, use <button> for a11y; otherwise <span>
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
  const styles: React.CSSProperties = {
    borderColor: ui.primary,
    color: ui.primary,
  }
  if (variant === 'pill') {
    styles.background = `linear-gradient(0deg, ${ui.secondary}10, transparent)`
  }

  const abbr = team?.abbreviation || '—'
  const name = team?.name || abbr

  return (
    <Component
      type={onClick ? 'button' : undefined}
      title={title || name}
      className={[base, heights[size], mdHeights, width, border, state, className].join(' ')}
      style={styles}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
    >
      <span className="truncate max-w-full">
        {labelMode === 'full' ? (
          <>
            <span className="md:hidden">{abbr}</span>
            <span className="hidden md:inline">{name}</span>
          </>
        ) : labelMode === 'abbrNick' ? (
          <>
            <span className="md:hidden">{abbr}</span>
            <span className="hidden md:inline">{name}</span>
          </>
        ) : (
          <>{abbr}</>
        )}
      </span>
    </Component>
  )
}
