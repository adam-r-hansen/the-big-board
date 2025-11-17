'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Member = { profile_id: string; role: 'owner'|'admin'|'member'; name: string; avatar: string|null; email: string|null }
type Team = { id: string; name: string; abbreviation: string }
type Game = { id: string; home_team: string; away_team: string; game_utc: string; status: string }

export default function LeagueAdminPage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const [members, setMembers] = useState<Member[]>([])
  const [log, setLog] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin'|'member'>('member')

  // Manual Pick Helper state
  const [selectedUser, setSelectedUser] = useState('')
  const [pickSeason, setPickSeason] = useState<number>(new Date().getFullYear())
  const [pickWeek, setPickWeek] = useState<number>(1)
  const [selectedTeam, setSelectedTeam] = useState('')
  const [availableTeams, setAvailableTeams] = useState<Team[]>([])
  const [userPicks, setUserPicks] = useState<{team_id: string}[]>([])
  const [allTeams, setAllTeams] = useState<Record<string, Team>>({})
  const [loadingPicks, setLoadingPicks] = useState(false)

  async function loadMembers() {
    setLog('')
    const res = await fetch(`/api/leagues/${leagueId}/members`, { cache:'no-store' })
    const j = await res.json()
    if (!res.ok) { setLog(j.error || 'load members failed'); return }
    setMembers(j.members ?? [])
  }

  // Load all teams on mount
  useEffect(() => {
    ;(async () => {
      try {
        const tm = await fetch('/api/team-map', { cache: 'no-store' }).then(r => r.json())
        setAllTeams(tm?.teams || {})
      } catch {}
    })()
  }, [])

  useEffect(() => { 
    if (leagueId) loadMembers() 
  }, [leagueId])

  // Load games and extract available teams when season/week changes
  useEffect(() => {
    if (!pickSeason || !pickWeek) return
    ;(async () => {
      try {
        const res = await fetch(`/api/games-for-week?season=${pickSeason}&week=${pickWeek}`, { cache: 'no-store' })
        const j = await res.json()
        const games: any[] = j.games || j || []
        
        // Extract unique team IDs from games
        const teamIds = new Set<string>()
        games.forEach(g => {
          const homeId = g.home?.id || g.home_team
          const awayId = g.away?.id || g.away_team
          if (homeId) teamIds.add(homeId)
          if (awayId) teamIds.add(awayId)
        })

        // Map team IDs to team objects
        const teams: Team[] = Array.from(teamIds)
          .map(id => allTeams[id])
          .filter(Boolean)
          .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation))

        setAvailableTeams(teams)
      } catch (e) {
        console.error('Failed to load games:', e)
        setAvailableTeams([])
      }
    })()
  }, [pickSeason, pickWeek, allTeams])

  // Load user's existing picks when user/season/week changes
  useEffect(() => {
    if (!selectedUser || !pickSeason || !pickWeek) {
      setUserPicks([])
      return
    }
    
    setLoadingPicks(true)
    ;(async () => {
      try {
        const res = await fetch(
          `/api/admin/leagues/${leagueId}/picks?season=${pickSeason}&week=${pickWeek}`,
          { cache: 'no-store' }
        )
        const j = await res.json()
        if (res.ok) {
          const picks = (j.picks || []).filter((p: any) => {
            // Match by email since that's what we store in selectedUser
            const member = members.find(m => m.profile_id === selectedUser)
            return p.email === member?.email
          })
          setUserPicks(picks.map((p: any) => ({ team_id: p.team_abbr })))
        } else {
          setUserPicks([])
        }
      } catch {
        setUserPicks([])
      } finally {
        setLoadingPicks(false)
      }
    })()
  }, [selectedUser, pickSeason, pickWeek, leagueId, members])

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

  async function createManualPick() {
    if (!selectedUser || !selectedTeam) return
    
    setLog('')
    const member = members.find(m => m.profile_id === selectedUser)
    if (!member?.email) {
      setLog('Member email not found')
      return
    }

    const team = availableTeams.find(t => t.id === selectedTeam)
    if (!team) {
      setLog('Team not found')
      return
    }

    const res = await fetch(`/api/admin/leagues/${leagueId}/picks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: member.email,
        season: pickSeason,
        week: pickWeek,
        teamAbbr: team.abbreviation,
        force: false
      })
    })

    const j = await res.json()
    if (!res.ok) {
      setLog(`Failed to create pick: ${j.error || 'Unknown error'}`)
      return
    }

    setLog(`✓ Pick created for ${member.name}: ${team.abbreviation} (Week ${pickWeek})`)
    setSelectedTeam('')
    
    // Reload picks to update the UI
    const reloadRes = await fetch(
      `/api/admin/leagues/${leagueId}/picks?season=${pickSeason}&week=${pickWeek}`,
      { cache: 'no-store' }
    )
    const reloadJ = await reloadRes.json()
    if (reloadRes.ok) {
      const picks = (reloadJ.picks || []).filter((p: any) => p.email === member.email)
      setUserPicks(picks.map((p: any) => ({ team_id: p.team_abbr })))
    }
  }

  // Check if a team has already been picked
  const isTeamPicked = (teamId: string) => {
    const team = allTeams[teamId]
    if (!team) return false
    return userPicks.some(p => p.team_id === team.abbreviation)
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
        <h2 className="font-semibold mb-3">Manual Pick Helper</h2>
        <p className="text-sm text-neutral-500 mb-4">Create picks on behalf of league members</p>
        
        <div className="grid gap-4">
          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">User</label>
            <select 
              className="w-full h-10 rounded-md border border-neutral-300 dark:border-neutral-700 px-3"
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
            >
              <option value="">Select a user...</option>
              {members.map(m => (
                <option key={m.profile_id} value={m.profile_id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Season & Week */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Season</label>
              <input 
                type="number" 
                className="w-full h-10 rounded-md border border-neutral-300 dark:border-neutral-700 px-3"
                value={pickSeason}
                onChange={e => setPickSeason(+e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Week</label>
              <input 
                type="number" 
                min="1" 
                max="18"
                className="w-full h-10 rounded-md border border-neutral-300 dark:border-neutral-700 px-3"
                value={pickWeek}
                onChange={e => setPickWeek(+e.target.value)}
              />
            </div>
          </div>

          {/* Team Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Team {loadingPicks && <span className="text-xs text-neutral-400">(loading picks...)</span>}
            </label>
            <select 
              className="w-full h-10 rounded-md border border-neutral-300 dark:border-neutral-700 px-3"
              value={selectedTeam}
              onChange={e => setSelectedTeam(e.target.value)}
              disabled={!selectedUser || availableTeams.length === 0}
            >
              <option value="">
                {availableTeams.length === 0 
                  ? 'No teams available for this week' 
                  : 'Select a team...'}
              </option>
              {availableTeams.map(t => {
                const picked = isTeamPicked(t.id)
                return (
                  <option 
                    key={t.id} 
                    value={t.id}
                    style={picked ? { color: '#999' } : undefined}
                  >
                    {t.abbreviation} - {t.name} {picked ? '(already picked)' : ''}
                  </option>
                )
              })}
            </select>
            {userPicks.length > 0 && (
              <p className="text-xs text-neutral-500 mt-1">
                Current picks: {userPicks.map(p => p.team_id).join(', ')}
              </p>
            )}
          </div>

          {/* Save Button */}
          <button
            className="h-10 px-6 rounded-md bg-black text-white dark:bg-white dark:text-black disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!selectedUser || !selectedTeam}
            onClick={createManualPick}
          >
            Save Pick
          </button>
        </div>
      </section>

      {log && (
        <div className={`text-sm p-3 rounded-md ${
          log.startsWith('✓') 
            ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
            : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
        }`}>
          {log}
        </div>
      )}
    </main>
  )
}
