'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type League = { id: string; name: string; season: number }
type Profile = { id: string; email?: string; display_name?: string | null }
type Unassigned = { id: string; email: string; display_name?: string | null }
type WrinkleInput = { name: string; description?: string; extra_picks?: number; week?: number }
type Team = { id: string; abbreviation?: string }

// Small UI atoms
function Card(props: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{props.title}</h2>
        {props.right}
      </header>
      {props.children}
    </section>
  )
}
function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props
  return (
    <button
      {...rest}
      className={[
        'px-3 py-2 rounded-xl border font-medium',
        'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      ].join(' ')}
    />
  )
}

// helpers
async function get<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}
async function post<T = any>(url: string, body: any): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const text = await res.text()
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
  if (!res.ok) throw new Error(data?.error || `${res.status} ${res.statusText}`)
  return data
}

export default function AdminPage() {
  // shared / bootstrap
  const [leagues, setLeagues] = useState<League[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState<string>('')

  // Email invite
  const [inviteEmail, setInviteEmail] = useState('')

  // Unassigned
  const [unassigned, setUnassigned] = useState<Unassigned[]>([])
  const [assignTarget, setAssignTarget] = useState<string>('')

  // Wrinkle
  const [wrinkle, setWrinkle] = useState<WrinkleInput>({ name: '', description: '', extra_picks: 0, week: 1 })

  // Create league
  const [newLeague, setNewLeague] = useState<{ name: string; season: number }>({
    name: '',
    season: new Date().getFullYear(),
  })

  // Branding (pill colors)
  const [pillLight, setPillLight] = useState('#10b981')
  const [pillDark, setPillDark] = useState('#34d399')

  // Profile editor
  const [profileQuery, setProfileQuery] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileName, setProfileName] = useState('')

  // Manual pick
  const [pickWeek, setPickWeek] = useState(1)
  const [pickMember, setPickMember] = useState('')
  const [pickTeam, setPickTeam] = useState('')

  function flash(s: string) {
    setMsg(s)
    setTimeout(() => setMsg(''), 3500)
  }

  // bootstrap data (real endpoints only)
  useEffect(() => {
    ;(async () => {
      try {
        const lj = await get<{ leagues: League[] }>('/api/my-leagues')
        const ls = lj?.leagues || []
        setLeagues(ls)
        if (!leagueId && ls[0]) setLeagueId(ls[0].id)
      } catch (e: any) {
        flash(`Leagues failed: ${e.message || e}`)
      }
      try {
        const tm = await get<any>('/api/team-map')
        const arr = Object.values(tm?.teams || {}) as any[]
        setTeams(arr.map((x: any) => ({ id: x.id, abbreviation: x.abbreviation })))
      } catch {}
      try {
        const u = await get<any>('/api/admin/unassigned')
        setUnassigned(Array.isArray(u?.rows) ? u.rows : (Array.isArray(u) ? u : []))
      } catch {}
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // members for selected league
  useEffect(() => {
    if (!leagueId) return
    ;(async () => {
      try {
        const j = await get<any>(`/api/admin/league-members?leagueId=${encodeURIComponent(leagueId)}`)
        setMembers(j?.members || [])
      } catch {}
    })()
  }, [leagueId])

  // actions (real endpoints)
  async function sendInvite() {
    if (!inviteEmail || !leagueId) return
    setBusy('invite')
    try {
      await post('/api/admin/invite', { email: inviteEmail, leagueId })
      setInviteEmail('')
      flash('Invite sent.')
    } catch (e: any) { flash(e.message || 'Invite failed') }
    finally { setBusy('') }
  }

  async function scheduleSync() {
    setBusy('sync')
    try { await post('/api/admin/schedule-sync', {}) ; flash('Schedule sync started.') }
    catch (e: any) { flash(e.message || 'Sync failed') }
    finally { setBusy('') }
  }

  async function refreshUnassigned() {
    try {
      const u = await get<any>('/api/admin/unassigned')
      setUnassigned(Array.isArray(u?.rows) ? u.rows : (Array.isArray(u) ? u : []))
    } catch (e: any) { flash(e.message || 'Could not refresh unassigned') }
  }

  async function assignPlayer() {
    if (!assignTarget || !leagueId) return
    setBusy('assign')
    try {
      await post('/api/admin/assign-to-league', { profileId: assignTarget, leagueId })
      setAssignTarget('')
      await refreshUnassigned()
      flash('Player assigned to league.')
    } catch (e: any) { flash(e.message || 'Assignment failed') }
    finally { setBusy('') }
  }

  async function createWrinkle() {
    if (!leagueId || !wrinkle.name) return
    setBusy('wrinkle')
    try {
      await post('/api/admin/wrinkles', { leagueId, ...wrinkle })
      setWrinkle({ name: '', description: '', extra_picks: 0, week: 1 })
      flash('Wrinkle created.')
    } catch (e: any) { flash(e.message || 'Wrinkle failed') }
    finally { setBusy('') }
  }

  async function createLeague() {
    if (!newLeague.name) return
    setBusy('league')
    try {
      await post('/api/admin/leagues', { name: newLeague.name, season: newLeague.season })
      setNewLeague({ name: '', season: new Date().getFullYear() })
      flash('League created.')
      const lj = await get<{ leagues: League[] }>('/api/my-leagues')
      setLeagues(lj?.leagues || [])
    } catch (e: any) { flash(e.message || 'Create league failed') }
    finally { setBusy('') }
  }

  async function savePillColors() {
    if (!leagueId) return
    setBusy('pill')
    try {
      await post('/api/admin/branding', { leagueId, pill_light: pillLight, pill_dark: pillDark })
      flash('Brand colors saved.')
    } catch (e: any) { flash(e.message || 'Save failed') }
    finally { setBusy('') }
  }

  async function lookupProfile() {
    if (!profileQuery) return
    setBusy('lookup')
    try {
      const j = await get<any>(`/api/admin/profile?query=${encodeURIComponent(profileQuery)}`)
      const p: Profile | null = j?.profile || null
      setProfile(p)
      setProfileName(p?.display_name || '')
      if (!p) flash('No profile found.')
    } catch (e: any) { flash(e.message || 'Lookup failed') }
    finally { setBusy('') }
  }

  async function saveProfileName() {
    if (!profile?.id) return
    setBusy('pname')
    try {
      await post('/api/admin/profile', { profileId: profile.id, display_name: profileName })
      flash('Profile updated.')
    } catch (e: any) { flash(e.message || 'Save failed') }
    finally { setBusy('') }
  }

  async function setManualPick() {
    if (!leagueId || !pickMember || !pickTeam || !pickWeek) return
    setBusy('mpick')
    try {
      await post('/api/admin/set-pick', { leagueId, profileId: pickMember, teamId: pickTeam, week: pickWeek })
      setPickTeam('')
      flash('Manual pick saved.')
    } catch (e: any) { flash(e.message || 'Manual pick failed') }
    finally { setBusy('') }
  }

  const leagueOptions = useMemo(
    () => leagues.map(l => <option key={l.id} value={l.id}>{l.name} · {l.season}</option>),
    [leagues]
  )

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5 flex items-center gap-3">
        <h1 className="text-xl font-bold">League Admin</h1>
        <div className="ml-auto flex items-center gap-3">
          <Link className="underline text-sm" href="/">Home</Link>
          <Link className="underline text-sm" href="/picks">Picks</Link>
          <Link className="underline text-sm" href="/standings">Standings</Link>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm">League</label>
        <select className="border rounded px-2 py-1 bg-transparent" value={leagueId} onChange={e => setLeagueId(e.target.value)}>
          {leagueOptions}
        </select>
        {msg ? <span className="text-sm text-emerald-600">{msg}</span> : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 grid gap-6">
          {/* Email Invite */}
          <Card title="Email Invite">
            <div className="flex gap-2 items-center">
              <input className="border rounded px-3 py-2 w-full bg-transparent" placeholder="name@email.com"
                     value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
              <Button disabled={!inviteEmail || !leagueId || busy==='invite'} onClick={sendInvite}>
                {busy==='invite' ? 'Sending…' : 'Send invite'}
              </Button>
            </div>
            <p className="text-xs text-neutral-500 mt-2">Sends a magic link & associates with the selected league.</p>
          </Card>

          {/* Schedule Sync */}
          <Card title="Schedule Sync">
            <div className="flex items-center gap-2">
              <Button disabled={busy==='sync'} onClick={scheduleSync}>
                {busy==='sync' ? 'Starting…' : 'Run sync now'}
              </Button>
              <span className="text-xs text-neutral-500">Refresh games from your upstream schedule source.</span>
            </div>
          </Card>

          {/* Unassigned */}
          <Card title="Unassigned Players">
            <div className="flex items-center gap-2 mb-3">
              <Button onClick={refreshUnassigned}>Refresh</Button>
              <span className="text-xs text-neutral-500">Players who signed up but aren’t in a league.</span>
            </div>
            {unassigned.length === 0 ? (
              <div className="text-sm text-neutral-500">None found.</div>
            ) : (
              <ul className="grid gap-2">
                {unassigned.map(u => (
                  <li key={u.id} className="border rounded-xl px-3 py-2 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{u.display_name || '—'}</div>
                      <div className="text-xs text-neutral-500">{u.email}</div>
                    </div>
                    <Button disabled={busy==='assign'} onClick={() => setAssignTarget(u.id)}>
                      {assignTarget === u.id ? 'Selected' : 'Select'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-center gap-2">
              <Button disabled={!assignTarget || !leagueId || busy==='assign'} onClick={assignPlayer}>
                {busy==='assign' ? 'Assigning…' : 'Assign selected → League'}
              </Button>
              <span className="text-xs text-neutral-500">Selected: {assignTarget || 'none'}</span>
            </div>
          </Card>

          {/* Wrinkle Creator */}
          <Card title="Wrinkle Creator">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input className="border rounded px-3 py-2 md:col-span-2 bg-transparent" placeholder="Name"
                     value={wrinkle.name} onChange={e => setWrinkle(v => ({ ...v, name: e.target.value }))}/>
              <input className="border rounded px-3 py-2 bg-transparent" placeholder="Extra picks (0)" type="number"
                     value={wrinkle.extra_picks ?? 0} onChange={e => setWrinkle(v => ({ ...v, extra_picks: Number(e.target.value) }))}/>
              <input className="border rounded px-3 py-2 bg-transparent" placeholder="Week" type="number"
                     value={wrinkle.week ?? 1} onChange={e => setWrinkle(v => ({ ...v, week: Number(e.target.value) }))}/>
            </div>
            <textarea className="border rounded px-3 py-2 w-full mt-2 bg-transparent" placeholder="Description (optional)"
                      value={wrinkle.description || ''} onChange={e => setWrinkle(v => ({ ...v, description: e.target.value }))}/>
            <div className="mt-2">
              <Button disabled={!leagueId || !wrinkle.name || busy==='wrinkle'} onClick={createWrinkle}>
                {busy==='wrinkle' ? 'Creating…' : 'Create wrinkle'}
              </Button>
            </div>
          </Card>

          {/* Create a League */}
          <Card title="Create a League">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input className="border rounded px-3 py-2 bg-transparent" placeholder="League name"
                     value={newLeague.name} onChange={e => setNewLeague(v => ({ ...v, name: e.target.value }))}/>
              <input className="border rounded px-3 py-2 bg-transparent" placeholder="Season" type="number"
                     value={newLeague.season} onChange={e => setNewLeague(v => ({ ...v, season: Number(e.target.value) }))}/>
              <Button disabled={!newLeague.name || busy==='league'} onClick={createLeague}>
                {busy==='league' ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right rail */}
        <aside className="lg:col-span-4 grid gap-6">
          {/* Light/Dark Pill Colors */}
          <Card title="Light/Dark Pill Colors">
            <div className="grid grid-cols-2 gap-3 items-center">
              <label className="text-sm">Light</label>
              <input type="color" value={pillLight} onChange={e => setPillLight(e.target.value)} className="w-16 h-9 p-0 border rounded"/>
              <label className="text-sm">Dark</label>
              <input type="color" value={pillDark} onChange={e => setPillDark(e.target.value)} className="w-16 h-9 p-0 border rounded"/>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="px-3 py-2 rounded-full border" style={{ background: pillLight }}>Light preview</span>
              <span className="px-3 py-2 rounded-full border" style={{ background: pillDark }}>Dark preview</span>
            </div>
            <div className="mt-3">
              <Button disabled={!leagueId || busy==='pill'} onClick={savePillColors}>
                {busy==='pill' ? 'Saving…' : 'Save colors'}
              </Button>
            </div>
          </Card>

          {/* Player Name / Profile Editor */}
          <Card title="Player Name / Profile Editor">
            <div className="flex gap-2">
              <input className="border rounded px-3 py-2 w-full bg-transparent" placeholder="Search email or id"
                     value={profileQuery} onChange={e => setProfileQuery(e.target.value)}/>
              <Button disabled={!profileQuery || busy==='lookup'} onClick={lookupProfile}>
                {busy==='lookup' ? 'Searching…' : 'Lookup'}
              </Button>
            </div>
            {profile ? (
              <div className="mt-3 grid gap-2">
                <div className="text-xs text-neutral-500">Profile: {profile.id} {profile.email ? `· ${profile.email}` : ''}</div>
                <input className="border rounded px-3 py-2 bg-transparent" placeholder="Display name"
                       value={profileName} onChange={e => setProfileName(e.target.value)}/>
                <Button disabled={!profileName || busy==='pname'} onClick={saveProfileName}>
                  {busy==='pname' ? 'Saving…' : 'Save name'}
                </Button>
              </div>
            ) : null}
          </Card>

          {/* Manual Pick Input */}
          <Card title="Manual Pick Input">
            <div className="grid grid-cols-1 gap-2">
              <div className="grid grid-cols-2 gap-2">
                <select className="border rounded px-2 py-2 bg-transparent" value={pickMember} onChange={e => setPickMember(e.target.value)}>
                  <option value="">Select member…</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{(m.display_name || m.email || m.id).toString()}</option>
                  ))}
                </select>
                <select className="border rounded px-2 py-2 bg-transparent" value={pickTeam} onChange={e => setPickTeam(e.target.value)}>
                  <option value="">Select team…</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.abbreviation || t.id}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" className="border rounded px-3 py-2 bg-transparent" placeholder="Week"
                       value={pickWeek} onChange={e => setPickWeek(Number(e.target.value))}/>
                <Button disabled={!leagueId || !pickMember || !pickTeam || busy==='mpick'} onClick={setManualPick}>
                  {busy==='mpick' ? 'Saving…' : 'Save pick'}
                </Button>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </main>
  )
}
