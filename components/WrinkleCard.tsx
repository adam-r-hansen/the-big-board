'use client'

import { useEffect, useMemo, useState } from 'react'
import TeamPill from '@/components/ui/TeamPill'
import { buildTeamIndex, type Team as TeamType } from '@/lib/teamColors'

type Team = TeamType

type Props = {
  g: { game_id: string }
  home?: { id?: string }
  away?: { id?: string }
  myPick?: { team_id?: string }
  isLocked: boolean
  // pick(teamId, gameId)
  pick: (teamId: string, gameId: string) => Promise<void> | void
}

export default function WrinkleCard({ g, home, away, myPick, isLocked, pick }: Props) {
  // Load team index so the pill can resolve Admin UI colors
  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})
  const teamIndex = useMemo(() => buildTeamIndex(teamMap), [teamMap])

  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        const tm = await fetch('/api/team-map', { cache: 'no-store' }).then(r => r.json())
        if (!ignore) setTeamMap(tm?.teams || {})
      } catch {
        // swallow – pills will render neutral if we can’t load the map
      }
    })()
    return () => {
      ignore = true
    }
  }, [])

  const selectedHome = myPick?.team_id && home?.id && myPick.team_id === home.id
  const selectedAway = myPick?.team_id && away?.id && myPick.team_id === away.id

  return (
    <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <button
            type="button"
            className="w-full"
            onClick={() => home?.id && !isLocked && pick(home.id, g.game_id)}
            disabled={isLocked}
          >
            <TeamPill
              teamId={home?.id}
              teamIndex={teamIndex}
              size="sm"
              mdUpSize="xl"
              fluid
              variant="subtle"
              labelMode="abbrNick"
              selected={!!selectedHome}
              disabled={isLocked}
            />
          </button>
        </div>

        <div className="text-neutral-400">—</div>

        <div className="flex-1">
          <button
            type="button"
            className="w-full"
            onClick={() => away?.id && !isLocked && pick(away.id, g.game_id)}
            disabled={isLocked}
          >
            <TeamPill
              teamId={away?.id}
              teamIndex={teamIndex}
              size="sm"
              mdUpSize="xl"
              fluid
              variant="subtle"
              labelMode="abbrNick"
              selected={!!selectedAway}
              disabled={isLocked}
            />
          </button>
        </div>
      </div>
    </article>
  )
}
