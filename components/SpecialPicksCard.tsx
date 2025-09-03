// components/SpecialPicksCard.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'

type TeamLike = {
  id?: string
  abbreviation?: string | null
  name?: string | null
  color_primary?: string | null
  color_secondary?: string | null
}

type Wrinkle = {
  id: string
  name: string
  kind: string
  extra_picks?: number | null
}

type WrinkleGame = {
  id: string
  game_id: string | null
  game_utc?: string | null
  status?: string | null
  home_team?: string | null
  away_team?: string | null
}

type Props = {
  leagueId: string
  season: number
  week: number
  // Accept whatever shape your /api/team-map gives us (nullable fields allowed)
  teams: Record<string, TeamLike>
}

function Pill({
  team,
  disabled,
  picked,
  onClick,
}: {
  team?: TeamLike
  disabled?: boolean
  picked?: boolean
  onClick?: () => void
}) {
  const abbr = team?.abbreviation ?? '—'
  const primary = (team?.color_primary ?? '#0a0a0a').toLowerCase()
  const secondary = (team?.color_secondary ?? '#e5e7eb').toLowerCase()

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'w-full h-14 rounded-xl border px-4 font-semibold tracking-wide',
        'transition-[transform,opacity] active:scale-[0.98]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90',
      ].join(' ')}
      style={{
        borderColor: primary,
        color: primary,
        boxShadow: picked ? `inset 0 0 0 2px ${primary}` : undefined,
        background:
          picked ? `linear-gradient(0deg, ${secondary}22, ${secondary}10)` : 'transparent',
      }}
    >
      {abbr}
    </button>
  )
}

export default function SpecialPicksCard({ leagueId, season, week, teams }: Props) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [wrinkle, setWrinkle] = useState<Wrinkle | null>(null)
  const [wGame, setWGame] = useState<WrinkleGame | null>(null)
  const [myPick, setMyPick] = useState<{ id: string; team_id: string; game_id: string | null } | null>(null)

  // Load active wrinkle
  useEffect(() => {
    if (!leagueId || !season || !week) return
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const res = await fetch(
          `/api/wrinkles/active?leagueId=${leagueId}&season=${season}&week=${week}`,
          { cache: 'no-store', credentials: 'include' },
        )
        const j = await res.json().catch(() => ({}))
        const w: Wrinkle | undefined = Array.isArray(j?.wrinkles) ? j.wrinkles[0] : j?.wrinkle
        setWrinkle(w ?? null)

        if (w?.id) {
          // linked game (if any)
          const gRes = await fetch(`/api/wrinkles/${w.id}/games`, { cache: 'no-store' })
          const gj = await gRes.json().catch(() => ({}))
          const row: WrinkleGame | undefined = Array.isArray(gj?.rows) ? gj.rows[0] : gj?.row || gj?.game
          setWGame(row ?? null)

          // my wrinkle pick (if any)
          const pRes = await fetch(`/api/wrinkles/${w.id}/picks`, { cache: 'no-store' })
          const pj = await pRes.json().catch(() => ({}))
          const p = Array.isArray(pj?.picks) ? pj.picks[0] : pj?.pick ?? null
          setMyPick(p)
        } else {
          setWGame(null)
          setMyPick(null)
        }
      } catch (e: any) {
        setErr(e?.message || 'Load failed')
      } finally {
        setLoading(false)
      }
    })()
  }, [leagueId, season, week])

  const home = useMemo(() => (wGame?.home_team ? teams[wGame.home_team] : undefined), [wGame, teams])
  const away = useMemo(() => (wGame?.away_team ? teams[wGame.away_team] : undefined), [wGame, teams])
  const locked = useMemo(() => {
    const t = wGame?.game_utc ? new Date(wGame.game_utc) : null
    return !!(t && t <= new Date())
  }, [wGame?.game_utc])

  async function pick(teamId: string) {
    try {
      setErr(null)
      const res = await fetch(`/api/wrinkles/${wrinkle!.id}/picks`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          teamId,
          gameId: wGame?.game_id ?? null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'Failed to save wrinkle pick')
      // refresh my pick
      const pRes = await fetch(`/api/wrinkles/${wrinkle!.id}/picks`, { cache: 'no-store' })
      const pj = await pRes.json().catch(() => ({}))
      setMyPick(Array.isArray(pj?.picks) ? pj.picks[0] : pj?.pick ?? null)
    } catch (e: any) {
      setErr(e?.message || 'Failed to save wrinkle pick')
    }
  }

  async function unpick() {
    if (!myPick || !wrinkle) return
    try {
      setErr(null)
      const r = await fetch(`/api/wrinkles/${wrinkle.id}/picks?id=${myPick.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j?.error) throw new Error(j?.error || 'Unpick failed')
      setMyPick(null)
    } catch (e: any) {
      setErr(e?.message || 'Unpick failed')
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Wrinkle</h2>
        {wrinkle?.extra_picks ? (
          <span className="text-xs rounded-full px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            +{wrinkle.extra_picks} extra pick{wrinkle.extra_picks > 1 ? 's' : ''}
          </span>
        ) : null}
      </header>

      {loading && <div className="text-sm text-neutral-500">Loading…</div>}
      {err && <div className="text-sm text-red-600">{err}</div>}

      {!loading && !wrinkle && (
        <div className="text-sm text-neutral-500">No active wrinkle for Week {week}.</div>
      )}

      {!loading && wrinkle && (
        <div className="grid gap-3">
          <div className="text-sm">
            <div className="text-neutral-900 dark:text-neutral-100 font-medium">{wrinkle.name}</div>
            {wGame?.game_utc && (
              <div className="text-neutral-500 dark:text-neutral-400">
                Kickoff: {new Date(wGame.game_utc).toLocaleString()}
              </div>
            )}
          </div>

          {/* If the wrinkle is linked to a game, show the two-team selector */}
          {wGame?.home_team && wGame?.away_team ? (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Pill
                  team={home}
                  disabled={locked}
                  picked={!!myPick && myPick.team_id === (home?.id ?? wGame.home_team!)}
                  onClick={() => pick((home?.id ?? wGame.home_team!) as string)}
                />
              </div>
              <div className="text-neutral-400">—</div>
              <div className="flex-1">
                <Pill
                  team={away}
                  disabled={locked}
                  picked={!!myPick && myPick.team_id === (away?.id ?? wGame.away_team!)}
                  onClick={() => pick((away?.id ?? wGame.away_team!) as string)}
                />
              </div>
            </div>
          ) : (
            <div className="text-sm text-neutral-500">No linked game.</div>
          )}

          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Special pick — doesn’t count toward weekly limit
          </div>

          {myPick && !locked && (
            <div>
              <button
                type="button"
                className="text-xs underline"
                onClick={unpick}
                aria-label="Unpick wrinkle"
              >
                Unpick
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

