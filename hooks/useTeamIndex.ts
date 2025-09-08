// hooks/useTeamIndex.ts
'use client'
import { useMemo } from 'react'
import type { TeamRecord } from '@/lib/teamColors'

export function useTeamIndex(teamMap: Record<string, TeamRecord>) {
  return useMemo(() => {
    const idx: Record<string, TeamRecord> = {}
    for (const t of Object.values(teamMap || {})) {
      if (!t?.id) continue
      idx[t.id] = t
      const ab = t.abbreviation?.toUpperCase()
      if (ab) idx[ab] = t
    }
    return idx
  }, [teamMap])
}
