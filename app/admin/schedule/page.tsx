'use client'
import { useEffect, useState } from 'react'

export default function GlobalSchedulePage() {
  const [isOwner, setIsOwner] = useState<boolean|null>(null)
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [weeksText, setWeeksText] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string>('')
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/is-site-owner', { cache: 'no-store' })
      const j = await res.json().catch(() => ({}))
      setIsOwner(!!j?.isOwner)
    })()
  }, [])

  function parseWeeks(text: string): number[] | 'all' {
    const t = text.trim().toLowerCase()
    if (!t || t === 'all') return 'all'
    const out = new Set<number>()
    for (const part of t.split(',')) {
      const s = part.trim()
      if (!s) continue
      if (s.includes('-')) {
        const [a,b] = s.split('-').map(x=>+x.trim())
        if (Number.isFinite(a) && Number.isFinite(b)) {
          const [start,end] = a<=b ? [a,b] : [b,a]
          for (let i=start;i<=end;i++) out.add(i)
        }
      } else {
        const n = +s; if (Number.isFinite(n)) out.add(n)
      }
    }
    return Array.from(out).sort((a,b)=>a-b)
  }

  async function syncFromESPN() {
    setMsg(''); setResult(null); setLoading(true)
    try {
      const weeks = parseWeeks(weeksText)
      const res = await fetch('/api/admin/schedule/espn', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ season, weeks })
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) { setMsg(j?.error || 'Sync failed'); return }
      setResult(j)
    } finally { setLoading(false) }
  }

  if (isOwner === null) return <main className="p-6">Loading…</main>
  if (!isOwner) return <main className="p-6">Forbidden (owner only)</main>

  return (
    <main className="mx-auto max-w-3xl p-6 grid gap-6">
      <h1 className="text-2xl font-bold">Global Schedule Sync (ESPN)</h1>
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">Season
            <input className="ml-2 h-9 w-28 rounded-md border px-2" type="number"
                   value={season} onChange={e=>setSeason(+e.target.value)} />
          </label>
          <label className="text-sm">Weeks
            <input className="ml-2 h-9 w-64 rounded-md border px-2"
                   placeholder="all or 1-4,6,10-12"
                   value={weeksText} onChange={e=>setWeeksText(e.target.value)} />
          </label>
          <button className="h-9 px-4 rounded-md bg-black text-white disabled:opacity-60"
                  disabled={loading} onClick={syncFromESPN}>
            {loading ? 'Syncing…' : 'Sync from ESPN'}
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          Pulls regular season (seasontype=2) from ESPN. Week 18 times are fluid—re-run to update.
        </p>
        {msg && <div className="text-sm text-red-600">{msg}</div>}
        {result && (
          <div className="text-sm">
            <div><b>Season:</b> {result.season}</div>
            <div><b>Weeks:</b> {Array.isArray(result.weeks) ? result.weeks.join(', ') : result.weeks}</div>
            <div><b>Fetched:</b> {result.counts?.fetched ?? 0}</div>
            <div><b>Inserted:</b> {result.counts?.inserted ?? 0} • <b>Updated:</b> {result.counts?.updated ?? 0} • <b>Skipped:</b> {result.counts?.skipped ?? 0}</div>
            {(result.fetchErrors?.length ?? 0) > 0 && (
              <>
                <div className="mt-2 font-medium">Fetch errors</div>
                <pre className="text-xs bg-neutral-50 dark:bg-neutral-800 p-2 rounded whitespace-pre-wrap">
                  {JSON.stringify(result.fetchErrors, null, 2)}
                </pre>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
