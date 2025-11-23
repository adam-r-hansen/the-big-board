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

function StatusPill({ status }: { status?: string }) {
  const s = (status || 'UPCOMING').toUpperCase()
  
  let pillClass = 'status-pill-upcoming'
  let displayText = 'Upcoming'
  let showDot = false

  if (s === 'LIVE') {
    pillClass = 'status-pill-live'
    displayText = 'Live'
    showDot = true
  } else if (s === 'FINAL') {
    pillClass = 'status-pill-final'
    displayText = 'Final'
  } else if (s === 'LOCKED') {
    pillClass = 'status-pill-locked'
    displayText = 'Locked'
  }

  return (
    <span className={`status-pill ${pillClass}`}>
      {showDot && <span className="status-pill-dot">●</span>}
      {displayText}
    </span>
  )
}

export default function PickPill({ teamId, teams, statusText, ariaLabel }: Props) {
  const t = teams[teamId] || ({} as TeamLike)

  const abbr = (t.abbreviation ?? '').toUpperCase()
  const shortName = (t.short_name ?? abbr).toString()
  const fullName = (t.name ?? shortName).toString()

  const primary = t.color_primary ?? '#111827'   // neutral-900 fallback
  const border = t.color_secondary ?? '#e5e7eb'  // neutral-200 fallback

  return (
    <div className="flex items-center justify-between gap-3 w-full">
      <div
        className="inline-flex select-none items-center justify-center rounded-2xl border px-3 py-2 w-24 md:w-64"
        style={{ borderColor: border }}
        aria-label={ariaLabel || fullName}
      >
        {/* desktop: full name (truncate) */}
        <span className="hidden md:inline truncate" style={{ color: primary, maxWidth: '14rem' }}>
          {fullName}
        </span>
        {/* mobile: short name */}
        <span className="md:hidden font-medium truncate" style={{ color: primary }}>
          {shortName}
        </span>
      </div>

      {statusText ? <StatusPill status={statusText} /> : null}
    </div>
  )
}
