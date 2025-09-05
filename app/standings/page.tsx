// app/standings/page.tsx
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
  const s = n.toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

export default async function StandingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const providedLeagueId = readParam(sp, 'leagueId')
  const season = Number(readParam(sp, 'season') ?? new Date().getUTCFullYear())
  const weekStr = readParam(sp, 'week')
  const week = weekStr ? Number(weekStr) : undefined

  // First, hit standings (it will auto-select a league if missing)
  const qs = new URLSearchParams({ season: String(season) })
  if (week !== undefined && Number.isFinite(week)) qs.set('week', String(week))
  if (providedLeagueId) qs.set('leagueId', providedLeagueId)

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
  let chosenLeagueId = ''
  try {
    const data = await fetchJSON<{ rows: typeof rows; leagueId: string }>(`/api/standings?${qs}`)
    rows = data.rows
    chosenLeagueId = data.leagueId || ''
  } catch {
    // leave empty
  }

  // Load leagues so we can show the chosen league's name
  let leagueName = '—'
  try {
    const ml = await fetchJSON<{ leagues: { id: string; name: string; season: number }[] }>('/api/my-leagues')
    const found = (ml.leagues || []).find(l => l.id === chosenLeagueId)
    if (found) leagueName = found.name
  } catch {
    // ignore
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Standings</h1>
        <div className="text-lg text-neutral-500">
          League: <span className="font-medium text-neutral-800">{leagueName}</span>
        </div>
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
                {rows.map((r) => (
                  <tr key={r.profile_id} className="border-b border-neutral-200 last:border-b-0">
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
