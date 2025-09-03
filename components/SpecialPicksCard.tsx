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

type Wrinkle = { id: string; name: string; extra_picks?: number | null }
type WrinkleGame = {
  id: string
  game_id: string | null
  home_team?: string | null // may be UUID or "PHI"
  away_team?: string | null // may be UUID or "DAL"
  game_utc?: string | null
  status?: string | null
}

type Props = {
  leagueId: string
  season: number
  week: number
  // IMPORTANT: pass the merged index keyed by UUID AND ABBR (uppercased)
  teams: Record<string, TeamLike>
}

function TeamButton({ team, disabled, picked, onClick }: {
  team?: TeamLike; disabled?: boolean; picked?: boolean; onClick?: () => void
}) {
  const abbr = team?.abbreviation ?? '—'
  const primary = team?.color_primary ?? '#6b7280'
  const secondary = team?.color_secondary ?? '#374151'
  return (
    <button
      type="button"
      disabled={!!disabled}
      onClick={disabled ? undefined : onClick}
      className={[
        'w-full h-12 rounded-xl border px-3 font-semibold tracking-wide text-sm',
        'transition-[transform,opacity] active:scale-[0.98]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90',
      ].join(' ')}
      style={{
        borderColor: primary,
        color: primary,
        boxShadow: picked ? `inset 0 0 0 2px ${primary}` : undefined,
        background: picked ? `linear-gradient(0deg, ${secondary}22, ${secondary}10)` : 'transparent',
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

  // Resolve by UUID or ABBR (uppercased)
  const resolveTeam = (key?: string | null): TeamLike | undefined => {
    if (!key) return undefined
    return teams[key] || teams[key.toUpperCase()]
  }
  const resolveTeamId = (key?: string | null): string | undefined => {
    const t = resolveTeam(key)
    return t?.id ?? undefined
  }

  // Resilient loader: swallow 401/404s from wrinkle endpoints so weekly picks stay interactive
  useEffect(() => {
    if (!leagueId || !season || !week) return
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        // active wrinkle
        let w: Wrinkle | null = null
        try {
          const res = await fetch(`/api/wrinkles/active?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: 'no-store' })
          const j = await res.json().catch(() => ({}))
          w = (Array.isArray(j?.wrinkles) ? j.wrinkles[0] : j?.wrinkle) ?? null
          setWrinkle(w)
        } catch { /* ignore */ }

        // wrinkle game row
        let row: WrinkleGame | null = null
        if (w?.id) {
          try {
            const gRes = await fetch(`/api/wrinkles/${w.id}/games`, { cache: 'no-store' })
            const gj = await gRes.json().catch(() => ({}))
            const first =
              (Array.isArray(gj?.rows) && gj.rows[0]) ||
              gj?.row ||
              (Array.isArray(gj?.games) && gj.games[0]) ||
              gj?.game ||
              null
            if (first) {
              row = {
                id: first.id ?? first.game_id ?? '',
                game_id: first.game_id ?? first.gameId ?? null,
                home_team: first.home_team ?? first.home_team_id ?? first.home ?? null,
                away_team: first.away_team ?? first.away_team_id ?? first.away ?? null,
                game_utc: first.game_utc ?? first.start_utc ?? first.start_time ?? null,
                status: first.status ?? null,
              }
            }
          } catch { /* ignore */ }
        }

        // hydrate via weekly schedule if only game_id present
        if (row?.game_id && (!row.home_team || !row.away_team)) {
          try {
            const wk = await fetch(`/api/games-for-week?season=${season}&week=${week}`, { cache: 'no-store' }).then(r => r.json())
            const match = (wk.games ?? []).find((g: any) => g.id === row!.game_id)
            if (match) {
              row = {
                ...row,
                home_team: match.home?.id ?? match.home_team ?? match.home?.abbreviation ?? row.home_team ?? null,
                away_team: match.away?.id ?? match.away_team ?? match.away?.abbreviation ?? row.away_team ?? null,
                game_utc: row.game_utc ?? match.game_utc ?? match.start_time ?? null,
                status: row.status ?? match.status ?? null,
              }
            }
          } catch { /* ignore */ }
        }

        setWGame(row ?? null)

        // my wrinkle pick (ignore if route missing/unauth)
        if (w?.id) {
          try {
            const pr = await fetch(`/api/wrinkles/${w.id}/picks`, { cache: 'no-store' })
            const pj = await pr.json().catch(() => ({}))
            setMyPick((Array.isArray(pj?.picks) ? pj.picks[0] : pj?.pick ?? null) as any)
          } catch { /* ignore */ }
        }
      } catch (e: any) {
        setErr(e?.message || 'Failed to load wrinkle')
      } finally {
        setLoading(false)
      }
    })()
  }, [leagueId, season, week])

  const locked = useMemo(() => (wGame?.game_utc ? new Date(wGame.game_utc) <= new Date() : false), [wGame?.game_utc])
  const home = resolveTeam(wGame?.home_team ?? null)
  const away = resolveTeam(wGame?.away_team ?? null)
  const myTeamId = myPick?.team_id ?? null

  async function pick(teamKey: string | null | undefined) {
    try {
      if (!wrinkle?.id) throw new Error('No active wrinkle')
      const teamId = resolveTeamId(teamKey)
      if (!teamId) throw new Error('Unknown team')
      const res = await fetch(`/api/wrinkles/${wrinkle.id}/picks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ teamId, gameId: wGame?.game_id ?? null }),
        cache: 'no-store',
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Pick failed')
      const pj = await fetch(`/api/wrinkles/${wrinkle.id}/picks`, { cache: 'no-store' }).then((r) => r.json())
      setMyPick((Array.isArray(pj?.picks) ? pj.picks[0] : pj?.pick ?? null) as any)
      setErr(null)
    } catch (e: any) {
      setErr(e?.message || 'Pick failed')
    }
  }

  async function unpick() {
    try {
      if (!wrinkle?.id || !myPick?.id) return
      const res = await fetch(`/api/wrinkles/${wrinkle.id}/picks?id=${myPick.id}`, { method: 'DELETE', cache: 'no-store' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Unpick failed')
      const pj = await fetch(`/api/wrinkles/${wrinkle.id}/picks`, { cache: 'no-store' }).then((r) => r.json())
      setMyPick((Array.isArray(pj?.picks) ? pj.picks[0] : pj?.pick ?? null) as any)
      setErr(null)
    } catch (e: any) {
      setErr(e?.message || 'Unpick failed')
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
      <header className="mb-3">
        <h2 className="text-lg font-semibold">Wrinkle pick</h2>
        {wrinkle ? (
          <div className="text-sm text-neutral-500">
            {wrinkle.name}
            {wrinkle.extra_picks ? ` • +${wrinkle.extra_picks}` : ''}
          </div>
        ) : (
          <div className="text-sm text-neutral-500">No active wrinkle</div>
        )}
      </header>

      {loading && <div className="text-sm text-neutral-500">Loading…</div>}
      {!loading && wrinkle && !wGame && <div className="text-sm text-neutral-500">No linked game</div>}

      {!loading && wrinkle && wGame && (
        <div className="grid gap-3">
          <div className="text-xs text-neutral-500">
            {wGame.game_utc ? new Date(wGame.game_utc).toLocaleString() : ''} {wGame.status ? `• ${wGame.status}` : ''}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <TeamButton
                team={home}
                picked={myTeamId === home?.id}
                disabled={locked || !home?.id}
                onClick={() => pick(wGame?.home_team)}
              />
            </div>
            <div className="text-neutral-400">—</div>
            <div className="flex-1">
              <TeamButton
                team={away}
                picked={myTeamId === away?.id}
                disabled={locked || !away?.id}
                onClick={() => pick(wGame?.away_team)}
              />
            </div>
          </div>

          {myPick && !locked && (
            <div>
              <button type="button" className="text-xs underline" onClick={unpick}>
                Unpick
              </button>
            </div>
          )}

          {err && <div className="text-xs text-red-600">{String(err)}</div>}
        </div>
      )}
    </section>
  )
}

