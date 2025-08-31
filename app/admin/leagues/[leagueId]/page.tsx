'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type Member = { profile_id: string; name: string; email: string|null; role: string }
type PickRow = { email: string; name: string; team_abbr: string|null }

export default function LeagueManagePage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const [tab, setTab] = useState<'members'|'picks'>('members')

  // Members
  const [members, setMembers] = useState<Member[]>([])
  const [mEmail, setMEmail] = useState('')
  const [mRole, setMRole] = useState<'member'|'admin'>('member')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // Picks
  const thisSeason = useMemo(() => new Date().getFullYear(), [])
  const [season, setSeason] = useState<number>(thisSeason)
  const [week, setWeek] = useState<number>(1)
  const [rows, setRows] = useState<PickRow[]>([])
  const [pEmail, setPEmail] = useState('')
  const [teamAbbr, setTeamAbbr] = useState('')
  const [force, setForce] = useState(false)

  async function loadMembers() {
    setMsg('')
    const res = await fetch(`/api/leagues/${leagueId}/members`, { cache: 'no-store' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(j?.error || 'Load members failed'); return }
    setMembers(j.members ?? [])
  }
  async function addMember() {
    setMsg(''); setLoading(true)
    try {
      const res = await fetch(`/api/leagues/${leagueId}/members`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: mEmail.trim(), role: mRole })
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) { setMsg(j?.error || 'Add failed'); return }
      setMEmail(''); setMRole('member'); await loadMembers()
    } finally { setLoading(false) }
  }

  async function loadPicks() {
    setMsg('')
    const res = await fetch(`/api/admin/leagues/${leagueId}/picks?season=${season}&week=${week}`, { cache: 'no-store' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(j?.error || 'Load picks failed'); return }
    setRows(j.picks ?? [])
  }
  async function setPick() {
    setMsg(''); setLoading(true)
    try {
      const res = await fetch(`/api/admin/leagues/${leagueId}/picks`, {
        method: 'POST',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify({ email: pEmail.trim(), season, week, teamAbbr: teamAbbr.trim(), force })
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) { setMsg(j?.error || 'Set pick failed'); return }
      await loadPicks()
    } finally { setLoading(false) }
  }
  async function removePick(email: string, team?: string) {
    setMsg(''); setLoading(true)
    try {
      const res = await fetch(`/api/admin/leagues/${leagueId}/picks`, {
        method: 'DELETE',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify({ email, season, week, teamAbbr: team })
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) { setMsg(j?.error || 'Remove pick failed'); return }
      await loadPicks()
    } finally { setLoading(false) }
  }

  useEffect(() => { if (tab==='members') loadMembers() }, [tab, leagueId])
  useEffect(() => { if (tab==='picks') loadPicks() }, [tab, leagueId, season, week])

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Manage League</h1>
        <Link href="/admin" className="text-sm underline">← Back to Admin</Link>
      </div>

      {msg && <p className="text-sm text-red-600">{msg}</p>}

      <div className="flex gap-2">
        <button onClick={()=>setTab('members')} className={`px-3 py-1.5 rounded-md border ${tab==='members'?'bg-neutral-100 dark:bg-neutral-800':''}`}>Members</button>
        <button onClick={()=>setTab('picks')} className={`px-3 py-1.5 rounded-md border ${tab==='picks'?'bg-neutral-100 dark:bg-neutral-800':''}`}>Picks</button>
      </div>

      {tab==='members' && (
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 grid gap-4">
          <h2 className="text-xl font-semibold">Members</h2>
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <input className="flex-1 h-10 rounded-md border px-3" placeholder="user@email.com" value={mEmail} onChange={e=>setMEmail(e.target.value)} />
            <select className="h-10 rounded-md border px-2" value={mRole} onChange={e=>setMRole(e.target.value as any)}>
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
            <button className="h-10 px-4 rounded-md bg-black text-white disabled:opacity-60" disabled={loading || !mEmail.trim()} onClick={addMember}>
              Add
            </button>
          </div>
          <ul className="grid gap-2">
            {members.map(m => (
              <li key={m.profile_id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                <span>{m.name}{m.email ? ` — ${m.email}` : ''}</span>
                <span className="text-xs uppercase tracking-wide text-neutral-500">{m.role}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab==='picks' && (
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 grid gap-4">
          <h2 className="text-xl font-semibold">Picks — manage by week</h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm">Season
              <input className="ml-2 h-9 w-28 rounded-md border px-2" type="number" value={season} onChange={e=>setSeason(+e.target.value)} />
            </label>
            <label className="text-sm">Week
              <input className="ml-2 h-9 w-20 rounded-md border px-2" type="number" value={week} onChange={e=>setWeek(+e.target.value)} />
            </label>
            <button className="h-9 px-3 rounded-md border" onClick={loadPicks}>Refresh</button>
          </div>

          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <input className="flex-1 h-10 rounded-md border px-3" placeholder="member@email.com" value={pEmail} onChange={e=>setPEmail(e.target.value)} />
            <input className="w-28 h-10 rounded-md border px-3" placeholder="Team (e.g., KC)" value={teamAbbr} onChange={e=>setTeamAbbr(e.target.value)} />
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={force} onChange={e=>setForce(e.target.checked)} />
              Force (override lock/limit)
            </label>
            <button className="h-10 px-4 rounded-md bg-black text-white disabled:opacity-60" disabled={loading || !pEmail.trim() || !teamAbbr.trim()} onClick={setPick}>
              Set Pick
            </button>
          </div>

          <ul className="grid gap-2">
            {rows.map(r => (
              <li key={`${r.email}-${r.team_abbr}`} className="flex items-center justify-between border rounded-lg px-3 py-2">
                <span>{r.name} — {r.email} — <b>{r.team_abbr ?? '—'}</b></span>
                <button className="text-sm underline" onClick={()=>removePick(r.email, r.team_abbr ?? undefined)}>Unpick</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
