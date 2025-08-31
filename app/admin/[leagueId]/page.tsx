'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Member = { profile_id: string; role: 'owner'|'admin'|'member'; name: string; avatar: string|null }

export default function LeagueAdminPage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const [members, setMembers] = useState<Member[]>([])
  const [log, setLog] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin'|'member'>('member')

  // Manual picks
  const [targetProfile, setTargetProfile] = useState('')
  const [season, setSeason] = useState<number>(new Date().getFullYear())
  const [week, setWeek] = useState<number>(1)
  const [teamId, setTeamId] = useState('')
  const [gameId, setGameId] = useState('')

  async function loadMembers() {
    setLog('')
    const res = await fetch(`/api/leagues/${leagueId}/members`, { cache:'no-store' })
    const j = await res.json()
    if (!res.ok) { setLog(j.error || 'load members failed'); return }
    setMembers(j.members ?? [])
  }

  useEffect(()=>{ if (leagueId) loadMembers() }, [leagueId])

  async function setRole(profileId: string, role: string) {
    setLog('')
    const res = await fetch(`/api/leagues/${leagueId}/members`, {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ action:'setRole', profileId, role })
    })
    const j = await res.json()
    if (!res.ok) { setLog(j.error || 'set role failed'); return }
    loadMembers()
  }

  async function removeMember(profileId: string) {
    setLog('')
    const res = await fetch(`/api/leagues/${leagueId}/members`, {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ action:'remove', profileId })
    })
    const j = await res.json()
    if (!res.ok) { setLog(j.error || 'remove failed'); return }
    loadMembers()
  }

  async function createInvite() {
    setLog('')
    const res = await fetch('/api/invites', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ leagueId, email: inviteEmail, role: inviteRole })
    })
    const j = await res.json()
    if (!res.ok) { setLog(j.error || 'invite failed'); return }
    setLog(`Invite created. Token: ${j.invite.token} (expires: ${j.invite.expires_at})`)
    setInviteEmail('')
  }

  async function adminCreatePick() {
    setLog('')
    const res = await fetch('/api/admin/picks', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ leagueId, profileId: targetProfile, season, week, teamId, gameId: gameId || null })
    })
    const j = await res.json()
    if (!res.ok) { setLog(j.error || 'admin create failed'); return }
    setLog('Pick created for member.')
  }

  async function adminDeletePick() {
    setLog('')
    const qs = new URLSearchParams({ leagueId: String(leagueId) })
    if (targetProfile) qs.set('profileId', targetProfile)
    if (teamId) qs.set('teamId', teamId)
    if (String(season)) qs.set('season', String(season))
    if (String(week)) qs.set('week', String(week))
    const res = await fetch(`/api/admin/picks?${qs.toString()}`, { method:'DELETE' })
    const j = await res.json()
    if (!res.ok) { setLog(j.error || 'admin delete failed'); return }
    setLog('Pick deleted for member (if existed).')
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 grid gap-6">
      <h1 className="text-2xl font-bold">League Admin</h1>

      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <h2 className="font-semibold mb-3">Members & Roles</h2>
        {members.length === 0 ? <div className="text-sm text-neutral-500">No members.</div> : (
          <ul className="grid gap-2">
            {members.map(m => (
              <li key={m.profile_id} className="flex items-center justify-between">
                <span>{m.name}</span>
                <div className="flex items-center gap-2">
                  <select className="h-8 border rounded px-2" value={m.role} onChange={e=>setRole(m.profile_id, e.target.value)}>
                    <option value="owner">owner</option>
                    <option value="admin">admin</option>
                    <option value="member">member</option>
                  </select>
                  <button className="h-8 px-3 border rounded" onClick={()=>removeMember(m.profile_id)}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <h2 className="font-semibold mb-3">Invite User</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <input className="h-9 rounded-md border px-2" placeholder="email@example.com" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} />
          <select className="h-9 rounded-md border px-2" value={inviteRole} onChange={e=>setInviteRole(e.target.value as any)}>
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
          <button className="h-9 px-4 rounded-md border" disabled={!inviteEmail} onClick={createInvite}>Create invite</button>
        </div>
        <p className="text-xs text-neutral-500 mt-2">MVP: we return a token you can DM; acceptance route coming next.</p>
      </section>

      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <h2 className="font-semibold mb-3">Manual Pick Intervention</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="h-9 rounded-md border px-2" placeholder="target profile_id" value={targetProfile} onChange={e=>setTargetProfile(e.target.value)} />
          <input className="h-9 rounded-md border px-2" type="number" placeholder="season" value={season} onChange={e=>setSeason(+e.target.value)} />
          <input className="h-9 rounded-md border px-2" type="number" placeholder="week" value={week} onChange={e=>setWeek(+e.target.value)} />
          <input className="h-9 rounded-md border px-2" placeholder="team_id" value={teamId} onChange={e=>setTeamId(e.target.value)} />
          <input className="h-9 rounded-md border px-2" placeholder="game_id (optional)" value={gameId} onChange={e=>setGameId(e.target.value)} />
        </div>
        <div className="flex gap-2 mt-3">
          <button className="h-9 px-4 rounded-md border" onClick={adminCreatePick} disabled={!targetProfile || !teamId}>Create pick</button>
          <button className="h-9 px-4 rounded-md border" onClick={adminDeletePick} disabled={!targetProfile || !teamId}>Delete pick</button>
        </div>
      </section>

      {log && <div className="text-xs text-red-600 whitespace-pre-wrap">{log}</div>}
    </main>
  )
}
