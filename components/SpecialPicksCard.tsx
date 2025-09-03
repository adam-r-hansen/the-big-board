// components/SpecialPicksCard.tsx
'use client'
import { useEffect, useMemo, useState } from 'react'

type TeamLike = {
  id: string
  abbreviation?: string
  name?: string | null
  color_primary?: string | null
  color_secondary?: string | null
}

type Props = {
  leagueId: string
  season: number
  week: number
  teams: Record<string, TeamLike>
}

type Wrinkle = {
  id: string
  name: string
  kind: string
  extra_picks: number
}

type WGGame = {
  id: string
  game_utc: string
  home_team: string
  away_team: string
  status?: string | null
}

type PickRow = { id: string; team_id: string; game_id: string | null }

function pillStyle(team?: TeamLike, picked?: boolean) {
  const c1 = team?.color_primary || '#111827' // neutral-900
  const c2 = team?.color_secondary || '#e5e7eb' // neutral-200
  return picked
    ? `border-[${c1}] bg-[${c1}] text-white`
    : `border-[${c1}] text-[${c1}]`
}

export default function SpecialPicksCard({ leagueId, season, week, teams }: Props) {
  const [loading, setLoading] = useState(false)
  const [wrinkle, setWrinkle] = useState<Wrinkle | null>(null)
  const [game, setGame] = useState<WGGame | null>(null)
  const [myPick, setMyPick] = useState<PickRow | null>(null)
  const [err, setErr] = useState<string>('')

  useEffect(() => {
    let alive = true
    async function load() {
      if (!leagueId || !season || !week) return
      setLoading(true)
      setErr('')
      try {
        // 1) active wrinkle
        const qs = new URLSearchParams({ leagueId, season: String(season), week: String(week) })
        const wRes = await fetch(`/api/wrinkles/active?${qs.toString()}`, { cache: 'no-store', credentials: 'include' })
        const wj = await wRes.json().catch(() => ({}))
        const w: Wrinkle | null = (wj && wj.wrinkle) || (wj && (wj.wrinkles?.[0] as Wrinkle)) || null
        if (!alive) return
        setWrinkle(w)
        setGame(null)
        setMyPick(null)

        if (w) {
          // 2) game for wrinkle
          const gRes = await fetch(`/api/wrinkles/${w.id}/games`, { cache: 'no-store', credentials: 'include' })
          const gj = await gRes.json().catch(() => ({}))
          const row: WGGame | null =
            (gj && gj.game) ||
            (Array.isArray(gj?.rows) && gj.rows[0]) ||
            (Array.isArray(gj?.data) && gj.data[0]) ||
            null
          if (!alive) return
          setGame(row)

          // 3) my wrinkle pick (if any)
          const pRes = await fetch(`/api/wrinkles/${w.id}/picks`, { cache: 'no-store', credentials: 'include' })
          const pj = await pRes.json().catch(() => ({}))
          const p: PickRow | null =
            (Array.isArray(pj?.picks) && pj.picks[0]) || pj?.pick || null
          if (!alive) return
          setMyPick(p)
        }
      } catch (e: any) {
        if (!alive) return
        setErr(e?.message || 'Load error')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [leagueId, season, week])

  const home = useMemo(() => (game ? teams[game.home_team] : undefined), [game, teams])
  const away = useMemo(() => (game ? teams[game.away_team] : undefined), [game, teams])
  const locked = useMemo(() => (game ? new Date(game.game_utc) <= new Date() : false), [game])

  async function savePick(teamId: string) {
    if (!wrinkle || !teamId) return
    setErr('')
    try {
      const res = await fetch(`/api/wrinkles/${wrinkle.id}/picks`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teamId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'Failed to save wrinkle pick')
      // refresh
      const pRes = await fetch(`/api/wrinkles/${wrinkle.id}/picks`, { cache: 'no-store', credentials: 'include' })
      const pj = await pRes.json().catch(() => ({}))
      setMyPick((Array.isArray(pj?.picks) && pj.picks[0]) || pj?.pick || null)
    } catch (e: any) {
      setErr(e?.message || 'Failed to save wrinkle pick')
    }
  }

  async function unpick() {
    if (!wrinkle || !myPick) return
    setErr('')
    try {
      const res = await fetch(`/api/wrinkles/${wrinkle.id}/picks?id=${encodeURIComponent(myPick.id)}`, {
        method: 'DELETE',
        cache: 'no-store',
        credentials: 'include',
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'Failed to remove wrinkle pick')
      setMyPick(null)
    } catch (e: any) {
      setErr(e?.message || 'Failed to remove wrinkle pick')
    }
  }

  return (
    <section className="relative z-10 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-amber-50/60 dark:bg-neutral-900 p-4 md:p-5">
      <h2 className="text-xl font-semibold mb-2">Wrinkle</h2>
      {!wrinkle && !loading && (
        <div className="text-sm text-neutral-600 dark:text-neutral-400">No active wrinkle for Week {week}.</div>
      )}

      {wrinkle && (
        <div className="grid gap-3">
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            {wrinkle.name}
            {game && <> • {new Date(game.game_utc).toLocaleString()}</>}
          </div>

          {game && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                className={`flex-1 h-12 rounded-xl border font-semibold tracking-wide
                ${myPick?.team_id === home?.id ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white dark:bg-neutral-950'}
              `}
                disabled={locked}
                onClick={() => savePick(home!.id)}
              >
                {home?.abbreviation || 'HOME'}
              </button>

              <span className="text-neutral-400">—</span>

              <button
                type="button"
                className={`flex-1 h-12 rounded-xl border font-semibold tracking-wide
                ${myPick?.team_id === away?.id ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white dark:bg-neutral-950'}
              `}
                disabled={locked}
                onClick={() => savePick(away!.id)}
              >
                {away?.abbreviation || 'AWAY'}
              </button>
            </div>
          )}

          {!game && <div className="text-sm text-neutral-600 dark:text-neutral-400">No linked game.</div>}

          {myPick && (
            <div className="text-xs">
              <button className="underline" onClick={unpick} disabled={locked}>
                {locked ? 'Locked' : 'Unpick'}
              </button>
            </div>
          )}
        </div>
      )}

      {loading && <div className="text-sm text-neutral-500">Loading…</div>}
      {err && <div className="mt-2 text-xs text-red-600">{err}</div>}
    </section>
  )
}

