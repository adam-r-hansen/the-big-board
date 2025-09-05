// components/PickPill.tsx
'use client'

import * as React from 'react'

export type TeamLike = {
  id: string
  name?: string | null
  short_name?: string | null
  abbreviation?: string | null
  color_primary?: string | null
  color_secondary?: string | null
}

type Props = {
  teamId: string
  teams: Record<string, TeamLike>
  statusText?: string // UPCOMING | LIVE | FINAL (optional)
  ariaLabel?: string
}

export default function PickPill({ teamId, teams, statusText, ariaLabel }: Props) {
  const t = teams[teamId] || ({} as TeamLike)

  const abbr = (t.abbreviation ?? '').toUpperCase()
  // fix: avoid mixing ?? with || by isolating the coalescing chain
  const nameBase = t.name ?? t.short_name ?? abbr
  const name = (nameBase || '—').toString()

  const primary = t.color_primary ?? '#111827'   // neutral-900 fallback
  const border = t.color_secondary ?? '#e5e7eb'  // neutral-200 fallback

  return (
    <div className="flex items-center justify-between gap-3 w-full">
      <div
        className="inline-flex select-none items-center justify-center rounded-2xl border px-3 py-2 w-24 md:w-64"
        style={{ borderColor: border }}
        aria-label={ariaLabel || name}
      >
        {/* desktop: full name (truncate) */}
        <span className="hidden md:inline truncate" style={{ color: primary, maxWidth: '14rem' }}>
          {name}
        </span>
        {/* mobile: abbreviation */}
        <span className="md:hidden font-medium" style={{ color: primary }}>
          {abbr || name}
        </span>
      </div>

      {statusText ? (
        <span className="text-sm text-neutral-500 shrink-0">{statusText}</span>
      ) : null}
    </div>
  )
}
