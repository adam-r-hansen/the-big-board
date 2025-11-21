// app/standings/page.tsx
export const dynamic = 'force-dynamic'

import { cookies, headers } from 'next/headers'

type SP = Record<string, string | string[] | undefined>

function readParam(sp: SP, key: string): string | undefined {
  const v = sp[key]
  return Array.isArray(v) ? v[0] : v
}

function fmtPts(n: number) {
  const s = n.toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

async function fetchJSONWithAuth<T>(path: string): Promise<T> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const origin = `${proto}://${host}`

  const cookieHeader = (await cookies()).toString()

  const res = await fetch(`${origin}${path}`, {
    cache: 'no-store',
    headers: {
      cookie: cookieHeader,
      'x-forwarded-host': host,
      'x-forwarded-proto': proto,
    },
  })
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return <span className="text-lg">🥇</span>
  }
  if (rank === 2) {
    return <span className="text-lg">🥈</span>
  }
  if (rank === 3) {
    return <span className="text-lg">🥉</span>
  }
  return <span className="font-medium text-neutral-600">{rank}</span>
}

export default async function StandingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const providedLeagueId = readParam(sp, 'leagueId')
  const season = Number(readParam(sp, 'season') ?? new Date().getUTCFullYear())
  const weekStr = readParam(sp, 'week')
  const week = weekStr ? Number(weekStr) : undefined

  const qs = new URLSearchParams({ season: String(season) })
  if (week !== undefined && Number.isFinite(week)) qs.set('week', String(week))
  if (providedLeagueId) qs.set('leagueId', providedLeagueId)

  type Row = {
    profile_id: string
    display_name: string
    preferred_color: string | null
    points: number
    correct: number
    longest_streak: number
    wrinkle_points: number
    rank: number
    back_from_first: number
    back_to_playoffs: number
  }

  let rows: Row[] = []
  let leagueName = '—'
  let startWeek = 1
  let isPlayoffLeague = true

  try {
    const data = await fetchJSONWithAuth<{
      rows: Row[]
      leagueId: string
      leagueName: string
      startWeek: number
    }>(`/api/standings?${qs.toString()}`)
    rows = data.rows ?? []
    leagueName = data.leagueName || '—'
    startWeek = data.startWeek ?? 1
    isPlayoffLeague = startWeek === 1
  } catch {
    // Leave empty state if fetch/auth fails
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Standings</h1>
        <div className="text-lg text-neutral-500">
          League: <span className="font-medium text-neutral-800 dark:text-neutral-200">{leagueName}</span>
        </div>
      </div>

      <section className="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {week === undefined ? 'Overall standings' : `Week ${week} standings`}
          </h2>
          {isPlayoffLeague && (
            <div className="text-sm text-neutral-500">Top 4 advance to playoffs</div>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 text-neutral-600 dark:text-neutral-400">
            No standings data yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate" style={{ borderSpacing: '0 8px' }}>
              <thead>
                <tr className="text-left text-neutral-600 dark:text-neutral-400 text-sm">
                  <th className="w-16 pb-2 pr-3">Rank</th>
                  <th className="pb-2 pr-3">Member</th>
                  <th className="w-24 pb-2 pr-3 text-right">Points</th>
                  <th className="w-24 pb-2 pr-3 text-right">Correct</th>
                  <th className="w-28 pb-2 pr-3 text-right">Behind</th>
                  {isPlayoffLeague && (
                    <th className="w-32 pb-2 text-right">To 4th</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const borderColor = r.preferred_color || '#6b7280'
                  const isPlayoffSpot = isPlayoffLeague && r.rank <= 4
                  return (
                    <tr
                      key={r.profile_id}
                      className={`rounded-xl transition-colors ${
                        isPlayoffSpot 
                          ? 'bg-green-50/50 dark:bg-green-950/20' 
                          : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                      }`}
                      style={{
                        borderLeft: `4px solid ${borderColor}`,
                      }}
                    >
                      <td className="py-3 pl-3 pr-3 rounded-l-xl">
                        <RankBadge rank={r.rank} />
                      </td>
                      <td className="py-3 pr-3 font-medium">{r.display_name || '—'}</td>
                      <td className="py-3 pr-3 text-right font-semibold text-lg">{fmtPts(r.points)}</td>
                      <td className="py-3 pr-3 text-right text-neutral-600 dark:text-neutral-400">{r.correct}</td>
                      <td className="py-3 pr-3 text-right text-neutral-600 dark:text-neutral-400">
                        {r.back_from_first === 0 ? '—' : `-${fmtPts(r.back_from_first)}`}
                      </td>
                      {isPlayoffLeague && (
                        <td className={`py-3 pr-3 text-right rounded-r-xl ${
                          r.rank <= 4 
                            ? 'text-green-600 dark:text-green-400 font-medium' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {r.back_to_playoffs === 0 ? '✓ In' : `-${fmtPts(r.back_to_playoffs)}`}
                        </td>
                      )}
                      {!isPlayoffLeague && <td className="rounded-r-xl"></td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
