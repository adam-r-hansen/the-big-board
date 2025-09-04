// app/scoreboard/page.tsx
'use client'

/**
 * Scoreboard (modernized to match Home/Picks)
 * - Responsive team chips: abbr on mobile, full name on desktop
 * - Uniform chip size for clean alignment
 * - Simple Week/Season selectors
 */

import { useEffect, useMemo, useState, Suspense, type ReactNode } from 'react'
import Link from 'next/link'

type Team = {
  id: string
  abbreviation: string | null
  name?: string | null
  color_primary?: string | null
  color_secondary?: string | null
  logo?: string | null
  logo_dark?: string | null
}

type TeamLike = {
  id?: string
  abbreviation?: string
  name?: string
  color_primary?: string
  color_secondary?: string
  logo?: string
  logo_dark?: string
}

type Game = {
  id: string
  season: number
  week: number
  game_utc: string
  status?: string
  home: { id?: string; abbr?: string | null; score?: number | null }
  away: { id?: string; abbr?: string | null; score?: number | null }
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
        <h1 className="text-lg font-semibold">{title}</h1>
        {right}
      </header>
      {children}
    </section>
  )
}

function Chip({
  label,
  primary = '#6b7280',
  secondary = '#374151',
  subtle = false,
  className = '',
}: {
  label: ReactNode
  primary?: string
  secondary?: string
  subtle?: boolean
  className?: string
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold',
        'overflow-hidden text-ellipsis whitespace-nowrap',
        subtle ? 'opacity-80' : '',
        className,
      ].join(' ')}
      style={{
        borderColor: primary,
        color: primary,
        background: subtle ? `linear-gradient(0deg, ${secondary}10, transparent)` : 'transparent',
      }}
    >
      {label}
    </span>
  )
}

function StatusBadge({ s }: { s?: string }) {
  const up = (s || 'UPCOMING').toUpperCase()
  return (
    <span className="text-[10px] tracking-wide uppercase text-neutral-500 dark:text-neutral-400">
      {up}
    </span>
  )
}

function useTeamIndex(teamMap: Record<string, Team>) {
  return useMemo(() => {
    const idx: Record<string, TeamLike> = {}
    for (const t of Object.values(teamMap || {})) {
      const v: TeamLike = {
        id: t.id,
        abbreviation: t.abbreviation ?? undefined,
        name: t.name ?? undefined,
        color_primary: t.color_primary ?? undefined,
        color_secondary: t.color_secondary ?? undefined,
        logo: t.logo ?? undefined,
        logo_dark: t.logo_dark ?? undefined,
      }
      if (t.id) idx[t.id] = v
      if (t.abbreviation) idx[t.abbreviation.toUpperCase()] = v
    }
    return idx
  }, [teamMap])
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
      abbr: x.home?.abbreviation ?? x.home_abbr ?? x.homeAbbr ?? x.home?.abbr ?? null,
      score: x.home_score ?? x.home?.score ?? null,
    },
    away: {
      id: x.away?.id ?? x.away_team ?? x.awayTeamId ?? x.away_team_id,
      abbr: x.away?.abbreviation ?? x.away_abbr ?? x.awayAbbr ?? x.away?.abbr ?? null,
      score: x.away_score ?? x.away?.score ?? null,
    },
  }))
}

function ScoreboardInner() {
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number>(1)

  const [teamMap, setTeamMap] = useState<Record<string, Team>>({})
  const teamIndex = useTeamIndex(teamMap)

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
        const g = await fetch(`/api/games-for-week?season=${season}&week=${week}`, {
          cache: 'no-store',
        }).then(r => r.json())
        setGames(normalizeGames(g?.games || g || []))
      } catch (e: any) {
        setMsg(e?.message || 'Failed to load games')
      }
    })()
  }, [season, week])

  // Responsive, UNIFORM-size team chip — abbr on mobile, full name on md+
  function responsiveTeamChip(teamId?: string) {
    if (!teamId)
      return <Chip label="—" className="w-full h-10 md:h-12 justify-center" />
    const t = teamIndex[teamId]
    const abbr = t?.abbreviation || '—'
    const full = t?.name || abbr
    const primary = t?.color_primary || '#6b7280'
    const secondary = t?.color_secondary || '#374151'
    return (
      <Chip
        label={
          <span className="truncate max-w-full">
            <span className="md:hidden">{abbr}</span>
            <span className="hidden md:inline">{full}</span>
          </span>
        }
        primary={primary}
        secondary={secondary}
        subtle
        className="w-full h-10 md:h-12 justify-center"
      />
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <section className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Scoreboard</h1>

        <div className="ml-auto flex items-center gap-3">
          <Link className="underline text-sm" href="/">
            Home
          </Link>
          <Link className="underline text-sm" href="/picks">
            Picks
          </Link>

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

      <Card
        title={`Week ${week} — Games`}
        right={
          <div className="flex items-center gap-3">
            <Link href="/picks" className="text-sm underline">
              Make picks →
            </Link>
          </div>
        }
      >
        {games.length === 0 ? (
          <div className="text-sm text-neutral-500">No games.</div>
        ) : (
          <div className="grid gap-4">
            {games.map((g) => {
              const kickoff = g.game_utc ? new Date(g.game_utc).toLocaleString() : ''
              const scoreKnown =
                typeof g.home.score === 'number' && typeof g.away.score === 'number'
              return (
                <article
                  key={g.id}
                  className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
                >
                  <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
                    <span>
                      {kickoff} • Week {g.week}
                    </span>
                    <StatusBadge s={g.status} />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">{responsiveTeamChip(g.home.id)}</div>
                    <div className="text-neutral-400">—</div>
                    <div className="flex-1">{responsiveTeamChip(g.away.id)}</div>
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
