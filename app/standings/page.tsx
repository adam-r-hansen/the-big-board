// app/standings/page.tsx
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type SP = Record<string, string | string[] | undefined>

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

function readParam(sp: SP, key: string): string | undefined {
  const v = sp[key]
  return Array.isArray(v) ? v[0] : v
}

function fmtPts(n: number) {
  // show .5 when needed, strip trailing .0
  const s = n.toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

export default async function StandingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const leagueId = readParam(sp, 'leagueId') ?? ''
  const season = Number(readParam(sp, 'season') ?? new Date().getUTCFullYear())
  const weekStr = readParam(sp, 'week')
  const week = weekStr ? Number(weekStr) : undefined

  // Load leagues for breadcrumb
  let myLeagues: { id: string; name: string; season: number }[] = []
  try {
    const data = await fetchJSON<{ leagues: { id: string; name: string; season: number }[] }>('/api/my-leagues')
    myLeagues = data.leagues
  } catch {/* ignore */}

  const chosenLeague = leagueId || myLeagues[0]?.id || ''
  const leagueName = myLeagues.find(l => l.id === chosenLeague)?.name ?? '—'

  // Standings
  const qs = new URLSearchParams({ leagueId: chosenLeague, season: String(season) })
  if (week !== undefined && Number.isFinite(week)) qs.set('week', String(week))

  let rows: {
    profile_id: string
    display_name: string
    points: number
    correct: number
    longest_streak: number
    wrinkle_points: number
    rank: number
    back_from_first: number
    back_to_playoffs: number
  }[] = []
  try {
    const data = await fetchJSON<{ rows: typeof rows }>(`/api/standings?${qs}`)
    rows = data.rows
  } catch {/* leave empty */}

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Standings</h1>
        <nav className="flex items-center gap-6 text-lg">
          <Link href="/picks" className="text-neutral-700 hover:underline">Picks</Link>
          <span className="text-neutral-500">
            League: <span className="font-medium text-neutral-800">{leagueName}</span>
          </span>
        </nav>
      </div>

      <section className="rounded-3xl border border-neutral-200 p-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {week === undefined ? 'Overall standings' : `Week ${week} standings`}
          </h2>
          <div className="text-sm text-neutral-500">Top 4 advance to playoffs</div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 p-6 text-neutral-600">
            No rows.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate" style={{ borderSpacing: 0 }}>
              <thead>
                <tr className="text-left text-neutral-600">
                  <th className="w-12 border-b border-neutral-300 py-2 pr-3">#</th>
                  <th className="border-b border-neutral-300 py-2 pr-3">Member</th>
                  <th className="w-24 border-b border-neutral-300 py-2 text-right">Pts</th>
                  <th className="w-24 border-b border-neutral-300 py-2 text-right">Correct</th>
                  <th className="w-28 border-b border-neutral-300 py-2 text-right">Back</th>
                  <th className="w-32 border-b border-neutral-300 py-2 text-right">Back to 4th</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.profile_id} className={`border-b border-neutral-200 last:border-b-0 ${idx === 3 ? 'bg-neutral-50' : ''}`}>
                    <td className="py-3 pr-3">{r.rank}</td>
                    <td className="py-3 pr-3">{r.display_name || '—'}</td>
                    <td className="py-3 text-right font-medium">{fmtPts(r.points)}</td>
                    <td className="py-3 text-right">{r.correct}</td>
                    <td className="py-3 text-right">{fmtPts(r.back_from_first)}</td>
                    <td className="py-3 text-right">{fmtPts(r.back_to_playoffs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
