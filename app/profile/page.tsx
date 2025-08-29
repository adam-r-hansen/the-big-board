'use client'

import { useEffect, useState } from 'react'

export default function ProfilePage() {
  const [p, setP] = useState<any>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(()=>{
    fetch('/api/profile').then(r=>r.json()).then(j=>{
      setP(j.profile || null)
      setName(j.profile?.display_name || '')
    })
  },[])

  async function save() {
    setSaving(true); setMsg('')
    const res = await fetch('/api/profile', { method:'PATCH', headers:{'content-type':'application/json'}, body: JSON.stringify({ display_name: name }) })
    setSaving(false)
    if (!res.ok) { setMsg('Save failed'); return }
    setMsg('Saved!')
  }

  if (!p) return <main className="mx-auto max-w-2xl px-4 py-6"><div className="text-sm text-neutral-500">Loading…</div></main>

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold">Your Profile</h1>
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-3 bg-white dark:bg-neutral-900">
        <div className="text-sm"><span className="text-neutral-500">Email:</span> {p.email}</div>
        <div className="space-y-1">
          <label className="text-sm text-neutral-500">Display name</label>
          <input className="h-9 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm" value={name} onChange={e=>setName(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={saving} className="h-9 rounded-md border border-neutral-300 dark:border-neutral-700 px-3 text-sm">{saving?'Saving…':'Save'}</button>
          {!!msg && <span className="text-sm text-neutral-500">{msg}</span>}
        </div>
      </div>
    </main>
  )
}
