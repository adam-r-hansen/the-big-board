'use client'
import { useState } from 'react'

export default function GlobalSchedulePage() {
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [weeks, setWeeks] = useState<string>('1')
  const [result, setResult] = useState<any>(null)
  const [status, setStatus] = useState<'idle'|'loading'|'ok'|'error'>('idle')

  async function run() {
    setStatus('loading'); setResult(null)
    try {
      const res = await fetch('/api/admin/schedule/espn', {
        method: 'POST',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify({ season, weeks })
      })
      const data = await res.json().catch(()=>null)
      setResult({ http: res.status, ...data })
      setStatus(res.ok && data?.ok !== false ? 'ok' : 'error')
    } catch (e:any) {
      setStatus('error')
      setResult({ http: 0, error: e?.message || String(e) })
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-extrabold mb-6">Global Schedule Sync (ESPN)</h1>
      <div className="rounded-2xl border p-5">
        <p className="text-sm text-neutral-600 mb-4">
          Pulls regular season (seasontype=2) from ESPN. Week 18 times are fluid—re-run to update.
        </p>
        <div className="flex gap-3 items-end mb-3">
          <label className="text-sm">Season
            <input className="ml-2 h-9 w-28 rounded-md border px-2 text-sm"
              type="number" value={season} onChange={e=>setSeason(+e.target.value)} />
          </label>
          <label className="text-sm">Weeks
            <input className="ml-2 h-9 w-64 rounded-md border px-2 text-sm"
              placeholder="e.g. 1,2 or 2-5 or all" value={weeks} onChange={e=>setWeeks(e.target.value)} />
          </label>
          <button onClick={run}
            className="ml-auto h-9 px-4 rounded-md bg-black text-white disabled:opacity-50"
            disabled={status==='loading'}>
            {status==='loading' ? 'Syncing…' : 'Sync from ESPN'}
          </button>
        </div>

        {status==='ok' && <p className="text-green-600 text-sm mb-2">Sync complete</p>}
        {status==='error' && <p className="text-red-600 text-sm mb-2">Sync failed</p>}

        {result && (
          <pre className="text-xs overflow-auto bg-neutral-50 border rounded p-3">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </main>
  )
}
