// components/HomeStandingsCard.tsx
export const dynamic = 'force-dynamic'

import { cookies, headers } from 'next/headers'

type Row = {
  profile_id: string
  display_name: string
  points: number
  correct: number
  longest_streak: number
  wrinkle_points: number
  rank: number
  back_from_first: number
  back_to_playoffs: number
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
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export default async function HomeStandingsCard(props: {
  leagueId: string
  season: number
}) {
  const { leagueId, season } = props

  let rows: Row[] = []
  try {
    const data = await fetchJSONWithAuth<{ rows: Row[] }>(
      `/api/standings?leagueId=${encodeURIComponent(leagueId)}&season=${season}`
    )
    rows = data.rows || []
  } catch {
    rows = []
  }

  return (
    <div className="rounded-3xl border border-neutral-200 p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xl font-semibold">Standings</h3>
        <a href="/standings" className="text-sm text-neutral-600 hover:underline">
          Standings →
        </a>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 p-5 text-neutral-600">
          No rows.
        </div>
      ) : (
        <table className="w-full border-separate" style={{ borderSpacing: 0 }}>
          <thead>
            <tr className="text-left text-neutral-600">
              <th className="w-8 border-b border-neutral-300 py-2">#</th>
              <th className="border-b border-neutral-300 py-2">Member</th>
              <th className="w-16 border-b border-neutral-300 py-2 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {/* IMPORTANT: no slice here → show ALL rows */}
            {rows.map((r) => (
              <tr key={r.profile_id} className="border-b border-neutral-200 last:border-b-0">
                <td className="py-2">{r.rank}</td>
                <td className="py-2">{r.display_name || '—'}</td>
                <td className="py-2 text-right">{Number(r.points).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
