// components/TeamButton.tsx
// Flat, no-gradient team button used on Home / Scoreboard / Picks

import * as React from 'react'

export type TeamLike = {
  id?: string
  abbreviation?: string | null
  name?: string | null
  short_name?: string | null
  color_primary?: string | null
  color_secondary?: string | null
}

type Props = {
  team: TeamLike
  /** "abbr" (default), "short", or "name" */
  labelMode?: 'abbr' | 'short' | 'name'
  /** highlight the button as selected */
  selected?: boolean
  /** disable interactions */
  disabled?: boolean
  /** click handler */
  onClick?: () => void
  /** optional title attribute */
  title?: string
  /** force a11y label; otherwise derived from team name */
  ariaLabel?: string
}

function safeColor(hex?: string | null, fallback = '#111827') {
  if (!hex) return fallback
  const trimmed = String(hex).trim()
  if (/^#([0-9a-fA-F]{3}){1,2}$/.test(trimmed)) return trimmed
  return fallback
}

export default function TeamButton({
  team,
  labelMode = 'name',
  selected = false,
  disabled = false,
  onClick,
  title,
  ariaLabel,
}: Props) {
  const primary = safeColor(team.color_primary, '#1f2937') // neutral-800 fallback
  const secondary = safeColor(team.color_secondary, '#e5e7eb') // neutral-200 fallback

  const abbr = (team.abbreviation ?? '').toUpperCase()
  const baseName =
    labelMode === 'abbr'
      ? (abbr || '—')
      : labelMode === 'short'
      ? ((team.short_name ?? abbr) || '—')
      : ((team.name ?? team.short_name ?? abbr) || '—')

  // FLAT style: solid bg, crisp border (team color), thicker when selected
  const borderWidth = selected ? 2 : 1
  const textColor = selected ? primary : '#0f172a' // slate-900
  const bgColor = '#ffffff' // flat white
  const borderColor = primary

  return (
    <button
      type="button"
      title={title || baseName}
      aria-label={ariaLabel || baseName}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={[
        'w-full h-20 md:h-20 rounded-2xl',
        'px-4 md:px-6',
        'flex items-center justify-center text-center',
        'text-base md:text-lg font-semibold',
        'transition-[transform,box-shadow,opacity] duration-150',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md active:scale-[0.99]',
        // ensure no gradient utility sneaks in
        'bg-white',
      ].join(' ')}
      style={{
        backgroundColor: bgColor,
        backgroundImage: 'none', // <- hard-kill any gradient
        color: textColor,
        borderStyle: 'solid',
        borderWidth,
        borderColor,
        boxShadow: selected
          ? `inset 0 0 0 9999px rgba(0,0,0,0), 0 1px 2px rgba(0,0,0,0.05)`
          : `inset 0 0 0 9999px rgba(0,0,0,0), 0 1px 2px rgba(0,0,0,0.04)`,
      }}
    >
      <span className="truncate max-w-full" style={{ textDecorationColor: secondary }}>
        {baseName}
      </span>
    </button>
  )
}
