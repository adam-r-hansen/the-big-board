'use client'
import * as React from 'react'
import type { TeamLike } from '@/lib/teamColors'
import { resolveTeamUi } from '@/lib/teamColors'

type Size = 'sm' | 'md' | 'lg' | 'xl'

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm md:text-base',
  lg: 'h-12 px-5 text-base md:text-lg',
  xl: 'h-12 md:h-14 px-6 md:px-7 text-lg md:text-xl',
}

/**
 * Uniform, responsive team pill that uses Admin-selected colors.
 * - Abbreviation on mobile, full name on md+
 * - Heavier border & inset ring when selected
 * - Fixed width on md+ for visual alignment; fluid on mobile
 */
function TeamPill({
  team,
  size = 'md',
  selected = false,
  className = '',
  title,
  fixedWidth = true,
}: {
  team?: TeamLike
  size?: Size
  selected?: boolean
  className?: string
  title?: string
  fixedWidth?: boolean
}) {
  const { primary, secondary } = resolveTeamUi(team)
  const abbr = team?.abbreviation || '—'
  const full = team?.name || team?.short_name || abbr

  return (
    <span
      title={title || full}
      className={[
        'inline-flex items-center justify-center rounded-2xl border font-semibold whitespace-nowrap truncate',
        sizeClasses[size],
        fixedWidth ? 'w-full md:w-64' : '',
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

export default TeamPill

// Optional compact badge for sidebars, if you need it:
// export function TeamBadge(...) { ... }
