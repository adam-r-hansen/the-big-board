'use client'

import { useEffect, useMemo, useState } from 'react'
import { buildTeamIndex, type Team as TeamType } from '@/lib/teamColors'

// Return type matches buildTeamIndex so consumers stay typed
type TeamIndex = ReturnType<typeof buildTeamIndex>

/**
 * Fetches /api/team-map and returns the canonical TeamIndex used by TeamPill.
 * No direct field reads (like `abbreviation`) so it stays compatible with TeamRecord.
 */
export default function useTeamIndex(): TeamIndex {
  const [teamMap, setTeamMap] = useState<Record<string, TeamType>>({})

  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        const tm = await fetch('/api/team-map', { cache: 'no-store' }).then((r) => r.json())
        if (!ignore) setTeamMap(tm?.teams || {})
      } catch {
        // leave empty -> TeamPill will render neutral colors
      }
    })()
    return () => {
      ignore = true
    }
  }, [])

  return useMemo(() => buildTeamIndex(teamMap), [teamMap])
}
