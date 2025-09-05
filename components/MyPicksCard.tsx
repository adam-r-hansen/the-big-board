// components/MyPicksCard.tsx
'use client'

import Link from 'next/link'
import PickPill, { TeamLike } from '@/components/PickPill'

export type WeekPick = {
  id: string
  team_id: string
  status?: 'UPCOMING' | 'LIVE' | 'FINAL' | string
}

type Props = {
  week: number
  picks: WeekPick[]
  teams: Record<string, TeamLike>
  editHref?: string // e.g., "/picks"
}

export default function MyPicksCard({ week, picks, teams, editHref = '/picks' }: Props) {
  return (
    <section className="rounded-3xl border border-neutral-200 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">My picks — Week {week}</h2>
        <Link href={editHref} className="text-sm text-neutral-700 hover:underline">
          Edit on Picks →
        </Link>
      </div>

      {picks.length === 0 ? (
        <p className="text-neutral-500 text-sm">No pick yet.</p>
      ) : (
        <ul className="space-y-3">
          {picks.map((p) => (
            <li key={p.id} className="flex items-center">
              <PickPill teamId={p.team_id} teams={teams} statusText={(p.status || '').toUpperCase()} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
