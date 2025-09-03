'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Team } from '@/types/domain'
import TeamColorButton from '@/components/TeamColorButton'
import WrinklePickButton from '@/components/WrinklePickButton'

type Props = {
  leagueId: string
  season: number
  week: number
  teams: Record<string, Team>
}

type Wrinkle = { id: string; name: string; kind: string }
type WGame = {
  id: string
  game_id: string
  game_utc: string
  home_team: string
  away_team: string
  status?: string | null
}
type Pick = { id: string; team_id: string; game_id: string | null }

function isLocked(utc?: string | null) {
  return !!utc && new Date(utc) <= new Date()
}

export default function SpecialPicksCard({ leagueId, season, week, teams }: Props) {
  const [wrinkle, setWrinkle] = useState<Wrinkle | null>(null)
  const [wgame, setWgame] = useState<WGame | null>(null)
  const [myPick, setMyPick] = useState<Pick | null>(null)
  const [err, setErr] = useState('')

  async function load() {
    setErr('')
    try {
      // 1) active wrinkle
      const qs = new URLSearchParams({ leagueId, season: String(season), week: String(week) }).toString()
      const wRes = await fetch(`/api/wrinkles/active?${qs}`, { cache: 'no-store', credentials: 'same-origin' })
      const wj = await wRes.json().catch(() => ({}))
      const act: Wrinkle | undefined = (wj?.wrinkles || [])[0]
      setWrinkle(act || null)

      if (!act?.id) {
        setWgame(null)
        setMyPick(null)
        return
      }

      // 2) wrinkle game
      const gRes = await fetch(`/api/wrinkles/${act.id}/games`, { cache: 'no-store', credentials: 'same-origin' })
      const gj = await gRes.json().catch(() => ({}))
      const g = gj?.row || gj?.wrinkle_game || (Array.isArray(gj?.data) ? gj.data[0] : null)
      setWgame(
        g
          ? {
              id: g.id || g.game_id,
              game_id: g.game_id || g.id,
              game_utc: g.game_utc,
              home_team: g.home_team,
              away_team: g.away_team,
              status: g.status ?? 'UPCOMING',
            }
          : null,
      )

      // 3) my wrinkle pick
      const pRes = await fetch(`/api/wrinkles/${act.id}/picks`, { cache: 'no-store', credentials: 'same-origin' })
      const pj = await pRes.json().catch(() => ({}))
      const p = Array.isArray(pj?.picks) ? pj.picks[0] : pj?.pick ?? null
      setMyPick(p)
    } catch (e: any) {
      setErr(e?.message || 'Failed to load wrinkle')
    }
  }

  useEffect(() => {
    if (leagueId && season && week) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, season, week])

  const locked = useMemo(() => isLocked(wgame?.game_utc), [wgame?.game_utc])
  const home = wgame ? teams[wgame.home_team] : undefined
  const away = wgame ? teams[wgame.away_team] : undefined

  if (!wrinkle) return null

  return (
    <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
      <header className="mb-3">
        <h3 className="text-lg font-bold">
          {wrinkle.name || 'Special Pick'}{' '}
          <span className="ml-2 text-xs font-medium text-neutral-500 uppercase">{wrinkle.kind}</span>
        </h3>
        {wgame && (
          <div className="text-xs text-neutral-500">
            {new Date(wgame.game_utc).toLocaleString()} • {locked ? 'LOCKED' : (wgame.status || 'UPCOMING')}
          </div>
        )}
      </header>

      {!wgame ? (
        <div className="text-sm text-neutral-500">No game configured for this wrinkle.</div>
      ) : (
        <div className="grid gap-3">
          {/* Display (non-click) color pills for clarity */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <TeamColorButton
                teamId={wgame.home_team}
                label={home?.abbreviation || 'HOME'}
                picked={myPick?.team_id === wgame.home_team}
                disabled
                onClick={() => {}}
                teams={teams}
              />
            </div>
            <div className="select-none text-neutral-400">—</div>
            <div className="flex-1">
              <TeamColorButton
                teamId={wgame.away_team}
                label={away?.abbreviation || 'AWAY'}
                picked={myPick?.team_id === wgame.away_team}
                disabled
                onClick={() => {}}
                teams={teams}
              />
            </div>
          </div>

          {/* Action buttons that actually POST the pick (this doesn't affect weekly pickability) */}
          <div className="grid grid-cols-2 gap-3">
            <WrinklePickButton
              wrinkleId={wrinkle.id}
              gameId={wgame.game_id}
              teamId={wgame.home_team}
              leagueId={leagueId}
              season={season}
              week={week}
              label={home?.abbreviation || 'HOME'}
              picked={myPick?.team_id === wgame.home_team}
              disabled={locked}
              onSaved={load}
            />
            <WrinklePickButton
              wrinkleId={wrinkle.id}
              gameId={wgame.game_id}
              teamId={wgame.away_team}
              leagueId={leagueId}
              season={season}
              week={week}
              label={away?.abbreviation || 'AWAY'}
              picked={myPick?.team_id === wgame.away_team}
              disabled={locked}
              onSaved={load}
            />
          </div>

          {!!myPick && !locked && (
            <button
              type="button"
              className="text-xs underline justify-self-start"
              onClick={async () => {
                const res = await fetch(`/api/wrinkles/${wrinkle.id}/picks?id=${myPick!.id}`, {
                  method: 'DELETE',
                  cache: 'no-store',
                  credentials: 'same-origin',
                })
                if (!res.ok) {
                  let msg = 'Failed to unpick'
                  try {
                    const j = await res.json()
                    if (j?.error) msg = j.error
                  } catch {}
                  alert(msg)
                } else {
                  await load()
                }
              }}
            >
              Unpick
            </button>
          )}

          {err && <div className="text-xs text-red-600">{err}</div>}
        </div>
      )}
    </article>
  )
}

