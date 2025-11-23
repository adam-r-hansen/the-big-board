// components/SpecialPicksCard.tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import TeamCard from '@/components/TeamCard'
import { getTeamCardVariant } from '@/lib/teamCardHelpers'

type TeamLike = {
  id?: string
  abbreviation?: string | null
  name?: string | null
  short_name?: string | null
  color_primary?: string | null
  color_secondary?: string | null
  color_pref_light?: string | null
  color_pref_dark?: string | null
  logo?: string | null
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
  home_team?: string | null
  away_team?: string | null
  game_utc?: string | null
  status?: string | null
}

type Props = {
  leagueId: string
  season: number
  week: number
  teams: Record<string, TeamLike>
}

export default function SpecialPicksCard({ leagueId, season, week, teams }: Props) {
  const [loading, setLoading] = useState(true)
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

  // Get wrinkle kind description
  const getWrinkleKindLabel = (kind: string): string => {
    switch (kind) {
      case 'bonus_game':
        return 'Bonus Pick'
      case 'bonus_game_ats':
        return 'Bonus Pick (Against the Spread)'
      case 'bonus_game_oof':
        return 'Bonus Pick (OOF)'
      case 'winless_double':
        return 'Winless Double'
      default:
        return 'Special Pick'
    }
  }

  // Resilient loader
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

        // If no wrinkle, stop here
        if (!w?.id) {
          setLoading(false)
          return
        }

        // wrinkle game row
        let row: WrinkleGame | null = null
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

        // my wrinkle pick
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

  const homePicked = home?.id ? myTeamId === home.id : false
  const awayPicked = away?.id ? myTeamId === away.id : false

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

  // Return null if no wrinkle (fast loading experience)
  if (!loading && !wrinkle) {
    return null
  }

  // Return null while loading (no flicker)
  if (loading) {
    return null
  }

  // At this point wrinkle is guaranteed to be non-null
  if (!wrinkle) return null

  return (
    <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
      <header className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-900/20 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-200">
            {getWrinkleKindLabel(wrinkle.kind)}
          </span>
          <h2 className="text-lg font-semibold">{wrinkle.name}</h2>
        </div>
        {wrinkle.extra_picks ? (
          <div className="text-sm text-neutral-500">
            +{wrinkle.extra_picks} extra pick{wrinkle.extra_picks !== 1 ? 's' : ''} • Doesn't count toward weekly limit
          </div>
        ) : (
          <div className="text-sm text-neutral-500">
            Doesn't count toward weekly limit
          </div>
        )}
      </header>

      {!wGame && <div className="text-sm text-neutral-500">No linked game</div>}

      {wGame && (
        <div className="grid gap-3">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {wGame.game_utc ? new Date(wGame.game_utc).toLocaleString() : ''} {wGame.status ? `• ${wGame.status}` : ''}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              {home ? (
                <TeamCard
                  team={{
                    id: home.id || '',
                    name: home.name || '',
                    short_name: home.short_name || home.name || '',
                    abbreviation: home.abbreviation || '',
                    logo: home.logo || '',
                    color_primary: home.color_primary || '#6b7280',
                    color_secondary: home.color_secondary,
                    color_pref_light: home.color_pref_light,
                    color_pref_dark: home.color_pref_dark,
                  }}
                  variant={getTeamCardVariant('picks', homePicked, false)}
                  displayText="short"
                  onClick={() => !locked && pick(wGame?.home_team)}
                  disabled={locked}
                />
              ) : (
                <div className="text-sm text-neutral-500">Team unavailable</div>
              )}
            </div>
            <div className="text-neutral-400 font-semibold">@</div>
            <div className="flex-1">
              {away ? (
                <TeamCard
                  team={{
                    id: away.id || '',
                    name: away.name || '',
                    short_name: away.short_name || away.name || '',
                    abbreviation: away.abbreviation || '',
                    logo: away.logo || '',
                    color_primary: away.color_primary || '#6b7280',
                    color_secondary: away.color_secondary,
                    color_pref_light: away.color_pref_light,
                    color_pref_dark: away.color_pref_dark,
                  }}
                  variant={getTeamCardVariant('picks', awayPicked, false)}
                  displayText="short"
                  onClick={() => !locked && pick(wGame?.away_team)}
                  disabled={locked}
                />
              ) : (
                <div className="text-sm text-neutral-500">Team unavailable</div>
              )}
            </div>
          </div>

          {myPick && !locked && (
            <div className="flex justify-end">
              <button type="button" className="text-xs underline text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100" onClick={unpick}>
                Unpick
              </button>
            </div>
          )}

          {err && <div className="text-xs text-red-600 dark:text-red-400">{String(err)}</div>}
        </div>
      )}
    </section>
  )
}
