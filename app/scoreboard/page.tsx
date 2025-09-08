'use client'

/**
 * Scoreboard page
 * - Pure display (no pick actions)
 * - Pills are FLUID to use the full width on desktop
 */

import { Suspense, useEffect, useMemo, useState } from 'react'
import TeamPill from '@/components/ui/TeamPill'
import { buildTeamIndex, type Team as TeamType } from '@/lib/teamColors'

type Team = TeamType

type Game = {
  id: string
  season: number
  week: number
  game_utc: string
  status?: string
  home: { id?: string; score?: number | null }
  away: { id?: string; score?: number | null }
}

function Card({
  children,
  title,
  right,
  className = '',
}: {
  children: React.ReactNode
  title: string
  right?: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={[
        'rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5',
        className,
      ].join(' ')}
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </header>
      {children}
    </section>
  )
}

function normalizeGames(rows: any[]): Game[] {
  return (rows || []).map((x: any) => ({
    id: x.id,
    season: x.season,
    week: x.week,
    game_utc: x.game_utc || x.start_time,
    status: x.status ?? 'UPCOMING',
    home: {
      id: x.home?.id ?? x.home_team ?? x.homeTeamId ?? x.home_team_id,
      score: x.home_score ?? x.home?.score ?? null,
    },
    away: {
      id: x.away?.id ?? x.away_team ?? x.awayTeamId ?? x.away_team_id,
      score: x.away_score ?? x.away?.score ?? null,
    },
  }))
}

export default function ScoreboardPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-xl font-bold mb-3">Scoreboard</h1>
          <div className="text-neutral-600">Loading…</div>
        </main>
      }
    >
      <ScoreboardInner />
    </Suspense>
  )
}

function ScoreboardInner() {
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number>(1)

  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})
  const teamIndex = useMemo(() => buildTeamIndex(teamMap), [teamMap])

  const [games, setGames] = useState<Game[]>([])
  const [msg, setMsg] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const tm = await fetch('/api/team-map', { cache: 'no-store' }).then(r => r.json())
        setTeamMap(tm?.teams || {})
      } catch {}
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      setMsg('')
      try {
        const g = await fetch(`/api/games-for-week?season=${season}&week=${week}`, { cache: 'no-store' })
          .then(r => r.json())
        setGames(normalizeGames(g?.games || g || []))
      } catch (e: any) {
        setMsg(e?.message || 'Failed to load games')
      }
    })()
  }, [season, week])

  const scoreboardPill = (teamId?: string) => (
    <TeamPill
      teamId={teamId}
      teamIndex={teamIndex}
      size="sm"
      mdUpSize="xl"
      fluid
      variant="subtle"
      labelMode="abbrNick"
    />
  )

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <section className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Scoreboard</h1>

        <div className="ml-auto flex items-center gap-3">
          <select
            className="border rounded px-2 py-1 bg-transparent"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
          >
            {Array.from({ length: 3 }).map((_, i) => {
              const yr = new Date().getFullYear() - 1 + i
              return (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              )
            })}
          </select>

          <select
            className="border rounded px-2 py-1 bg-transparent"
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
          >
            {Array.from({ length: 18 }).map((_, i) => {
              const wk = i + 1
              return (
                <option key={wk} value={wk}>
                  {wk}
                </option>
              )
            })}
          </select>
        </div>
      </section>

      <Card title={`Week ${week} — Games`}>
        {games.length === 0 ? (
          <div className="text-sm text-neutral-500">No games.</div>
        ) : (
          <div className="grid gap-4">
            {games.map((g) => {
              const scoreKnown =
                typeof g.home.score === 'number' && typeof g.away.score === 'number'
              return (
                <article
                  key={g.id}
                  className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
                >
                  <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
                    <span>
                      {g.game_utc ? new Date(g.game_utc).toLocaleString() : ''} • Week {g.week}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide">
                      {(g.status || 'UPCOMING').toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1">{scoreboardPill(g.home.id)}</div>
                    <div className="text-neutral-400">—</div>
                    <div className="flex-1">{scoreboardPill(g.away.id)}</div>
                  </div>

                  <div className="mt-1 text-xs text-neutral-500">
                    {scoreKnown ? (
                      <span>
                        Score: {g.home.score} — {g.away.score}
                      </span>
                    ) : (
                      <span>— — —</span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </Card>

      {msg && <div className="text-xs mt-2">{msg}</div>}
    </main>
  )
}
