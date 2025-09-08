'use client'
import * as React from 'react'
import type { TeamLike } from '@/lib/teamColors'
import { resolveTeamUi } from '@/lib/teamColors'

type Size = 'sm' | 'md' | 'lg' | 'xl'
type LabelMode = 'auto' | 'abbr' | 'full' | 'abbrNick' // back-compat

const baseSize: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm md:text-base',
  lg: 'h-12 px-5 text-base md:text-lg',
  xl: 'h-12 px-6 text-lg',
}

const mdUpSize: Record<Size, string> = {
  sm: 'md:h-8 md:px-3 md:text-sm',
  md: 'md:h-10 md:px-4 md:text-base',
  lg: 'md:h-12 md:px-5 md:text-lg',
  xl: 'md:h-14 md:px-7 md:text-xl',
}

type Props = {
  /** New API */
  team?: TeamLike
  size?: Size
  selected?: boolean
  className?: string
  title?: string
  /** when false (or omitted), md+ gets a fixed width; when true, always fluid */
  fixedWidth?: boolean

  /** --- Back-compat props still used on pages --- */
  teamId?: string
  teamIndex?: Record<string, TeamLike>
  mdUpSize?: Size
  fluid?: boolean
  labelMode?: LabelMode
  variant?: 'pill' | 'chip' | 'subtle' // accept legacy "subtle"
  disabled?: boolean
}

export default function TeamPill(props: Props) {
  const {
    // new
    team: teamProp,
    size = 'md',
    selected = false,
    className = '',
    title,
    fixedWidth,

    // back-compat
    teamId,
    teamIndex,
    mdUpSize: mdSizeProp,
    fluid,
    labelMode = 'auto',
    // variant is accepted for compatibility; current styling treats all as "pill/subtle"
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    variant,
    disabled = false,
  } = props

  const team = teamProp ?? (teamId ? teamIndex?.[teamId] : undefined)
  const { primary, secondary } = resolveTeamUi(team)
  const abbr = team?.abbreviation || '—'
  const nickname = team?.short_name || abbr
  const full = team?.name || nickname

  // width: legacy `fluid` overrides `fixedWidth`
  const isFluid = typeof fluid === 'boolean' ? fluid : fixedWidth === false
  const widthClasses = isFluid ? 'w-full' : 'w-full md:w-64'

  const mdSize = mdSizeProp ?? 'xl'
  const sizeClasses = [baseSize[size], mdUpSize[mdSize]].join(' ')

  let label: React.ReactNode
  switch (labelMode) {
    case 'abbr':
      label = <span className="truncate">{abbr}</span>
      break
    case 'full':
      label = <span className="truncate">{full}</span>
      break
    case 'abbrNick':
      // old behavior: abbr on mobile, nickname on md+
      label = (
        <span className="truncate">
          <span className="md:hidden">{abbr}</span>
          <span className="hidden md:inline">{nickname}</span>
        </span>
      )
      break
    default:
      // auto: abbr on mobile, full name on md+
      label = (
        <span className="truncate">
          <span className="md:hidden">{abbr}</span>
          <span className="hidden md:inline">{full}</span>
        </span>
      )
  }

  return (
    <span
      title={title || full}
      aria-disabled={disabled || undefined}
      className={[
        'inline-flex items-center justify-center rounded-2xl border font-semibold whitespace-nowrap truncate',
        widthClasses,
        sizeClasses,
        selected ? 'ring-2 ring-offset-0' : '',
        disabled ? 'opacity-50 pointer-events-none' : '',
        className,
      ].join(' ')}
      style={{
        borderColor: primary,
        color: primary,
        background: `${secondary}10`, // subtle fill
        boxShadow: selected ? `0 0 0 2px ${primary} inset` : undefined,
      }}
    >
      {label}
    </span>
  )
}
