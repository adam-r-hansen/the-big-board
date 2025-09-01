'use client'
import TeamPill from '@/components/TeamPill'
import type { Team } from '@/types/domain'
import WrinkleBadge from '@/components/WrinkleBadge'

type WrinkleGame = {
  id: string
  game_id: string
  game_utc: string
  home_team: string
  away_team: string
  spread?: number|null
}

type Wrinkle = {
  id: string
  name: string
  kind: string
  status: string
  season: number
  week: number
  extra_picks?: number
  games?: WrinkleGame[]
}

type Pick = { id: string; team_id: string; game_id: string|null }

type Props = {
  wrinkle: Wrinkle
  teams: Record<string, Team>
  myPick: Pick | null
  onChanged: () => void
}

export default function WrinkleCard({ wrinkle, teams, myPick, onChanged }: Props) {
  const locked = (utc: string) => new Date(utc) <= new Date()

  async function pick(teamId: string, gameId: string) {
    const res = await fetch(`/api/wrinkles/${wrinkle.id}/picks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teamId, gameId }),
      cache: 'no-store',
    })
    if (!res.ok) {
      let msg = 'Pick failed'
      try { const j = await res.json(); msg = j?.error || msg } catch {}
      alert(msg)
      return
    }
    onChanged()
  }

  async function unpick() {
    if (!myPick?.id) return
    const res = await fetch(`/api/wrinkles/${wrinkle.id}/picks?id=${myPick.id}`, {
      method: 'DELETE',
      cache: 'no-store',
    })
    if (!res.ok) {
      let msg = 'Unpick failed'
      try { const j = await res.json(); msg = j?.error || msg } catch {}
      alert(msg)
      return
    }
    onChanged()
  }

  const g = (wrinkle.games ?? [])[0] // MVP: assume 1 game per wrinkle
  const home = g ? teams[g.home_team] : undefined
  const away = g ? teams[g.away_team] : undefined
  const isLocked = g ? locked(g.game_utc) : true

  return (
    <article className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-900/10 p-4">
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <WrinkleBadge kind={wrinkle.kind} />
          <h3 className="text-sm font-semibold">{wrinkle.name}</h3>
        </div>
        <div className="text-[11px] text-amber-800/70 dark:text-amber-200/80">
          {g ? new Date(g.game_utc).toLocaleString() : '—'}
        </div>
      </header>

      {g ? (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <TeamPill
              team={home}
              picked={myPick?.team_id === home?.id}
              disabled={isLocked}
              onClick={() => pick(home!.id, g.game_id)}
            />
          </div>
          <div className="text-neutral-400">—</div>
          <div className="flex-1">
            <TeamPill
              team={away}
              picked={myPick?.team_id === away?.id}
              disabled={isLocked}
              onClick={() => pick(away!.id, g.game_id)}
            />
          </div>
        </div>
      ) : (
        <div className="text-xs text-neutral-500">No linked game.</div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs">
        <div className="text-amber-900/80 dark:text-amber-200/80">
          {wrinkle.kind === 'spread' && g?.spread != null
            ? `Spread: ${g.spread > 0 ? `+${g.spread}` : g.spread}`
            : `Special pick — doesn’t count toward weekly limit`}
        </div>
        <div>
          {myPick ? (
            <button
              type="button"
              className="underline text-amber-900/80 dark:text-amber-200/80 disabled:opacity-50"
              disabled={isLocked}
              onClick={unpick}
              title={isLocked ? 'Locked (kickoff passed)' : 'Unpick'}
            >
              {isLocked ? 'Locked' : 'Unpick'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
