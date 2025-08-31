'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function SchedulePage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const [role, setRole] = useState<string|null>(null)
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [payload, setPayload] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string>('')
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/leagues/${leagueId}/me`, { cache: 'no-store' })
      const j = await res.json().catch(() => ({}))
      setRole(j?.role ?? null)
    })()
  }, [leagueId])

  async function syncNow() {
    setMsg(''); setResult(null); setLoading(true)
    try {
      let items: any
      try { items = JSON.parse(payload) } catch { setMsg('Invalid JSON'); return }
      if (!Array.isArray(items) || items.length === 0) { setMsg('Provide a non-empty JSON array'); return }
      const res = await fetch(`/api/admin/leagues/${leagueId}/schedule/sync`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ season, items })
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) { setMsg(j?.error || 'Sync failed'); return }
      setResult(j)
    } finally { setLoading(false) }
  }

  if (role === null) return <main className="p-6">Loading…</main>
  if (role !== 'owner') return <main className="p-6">Forbidden (owner only)</main>

  return (
    <main className="mx-auto max-w-3xl p-6 grid gap-4">
      <h1 className="text-2xl font-bold">Schedule Sync</h1>
      <p className="text-sm text-neutral-600">
        Paste JSON like:
      </p>
      <pre className="text-xs bg-neutral-50 dark:bg-neutral-800 p-3 rounded">{`[
  { "week": 2, "kickoff": "2025-09-11T00:20:00Z", "home": "KC", "away": "BAL" },
  { "week": 2, "kickoff": "2025-09-14T17:00:00Z", "home": "DAL", "away": "PHI" }
]`}</pre>

      <div className="flex items-center gap-3">
        <label className="text-sm">Season
          <input className="ml-2 h-9 w-28 rounded-md border px-2" type="number"
                 value={season} onChange={e=>setSeason(+e.target.value)} />
        </label>
        <button className="h-9 px-3 rounded-md border"
                onClick={()=>setPayload(JSON.stringify([{week:18,kickoff:"2026-01-04T18:00:00Z",home:"TBD",away:"TBD"}],null,2))}>
          Template: Week 18
        </button>
      </div>

      <textarea className="w-full h-56 rounded-md border px-3 py-2 font-mono text-sm"
                placeholder='[ { "week": 2, "kickoff": "...", "home": "KC", "away": "BAL" } ]'
                value={payload} onChange={e=>setPayload(e.target.value)} />

      <div className="flex items-center gap-3">
        <button className="h-10 px-4 rounded-md bg-black text-white disabled:opacity-60"
                disabled={loading || !payload.trim()} onClick={syncNow}>
          {loading ? 'Syncing…' : 'Sync schedule'}
        </button>
        {msg && <span className="text-sm text-red-600">{msg}</span>}
      </div>

      {result && (
        <div className="text-sm">
          <div className="mb-1">Season {result.season}</div>
          <div>Inserted: {result.counts?.inserted ?? 0} • Updated: {result.counts?.updated ?? 0} • Skipped: {result.counts?.skipped ?? 0}</div>
          {(result.errors?.length ?? 0) > 0 && (
            <details className="mt-2">
              <summary>Errors ({result.errors.length})</summary>
              <pre className="text-xs bg-neutral-50 dark:bg-neutral-800 p-2 rounded whitespace-pre-wrap">
                {JSON.stringify(result.errors, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </main>
  )
}
