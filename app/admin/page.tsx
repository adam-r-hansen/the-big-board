'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TeamPillColors from '@/components/admin/TeamPillColors'

type League = { id: string; name: string; season: number }
type Profile = { id: string; email?: string; display_name?: string | null }
type Unassigned = { id: string; email: string; display_name?: string | null }
type Team = { id: string; abbreviation?: string }

type WrinkleRow = {
  id: string
  season: number
  week: number
  name: string
  status: string
  kind: string
  extra_picks: number
  created_at?: string
  params?: any
}

type GameRow = {
  id: string
  game_utc?: string | null
  status?: string | null
  home?: { id?: string; abbr?: string | null }
  away?: { id?: string; abbr?: string | null }
}

// ————— UI —————
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
function Segmented({
  value, onChange, items,
}: { value: string; onChange: (v: string) => void; items: { label: string; value: string }[] }) {
  return (
    <div className="inline-flex rounded-xl border border-neutral-300 dark:border-neutral-700 overflow-hidden">
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={[
            'px-3 py-1.5 text-sm',
            value === it.value
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
              : 'bg-white dark:bg-neutral-900',
          ].join(' ')}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

// ————— helpers —————
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
  // workspace mode
  const [mode, setMode] = useState<'app' | 'league'>('league')

  // shared bootstrap
  const [leagues, setLeagues] = useState<League[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState<string>('')

  // League workspace state
  const [leagueId, setLeagueId] = useState('')
  const currentLeague = useMemo(() => leagues.find(l => l.id === leagueId) || null, [leagues, leagueId])

  const [members, setMembers] = useState<Profile[]>([])
  const [inviteEmail, setInviteEmail] = useState('')

  // Wrinkle creator
  const [wrinkleName, setWrinkleName] = useState('')
  const [wrinkleDesc, setWrinkleDesc] = useState('')
  const [wrinkleWeek, setWrinkleWeek] = useState<number>(1)
  const [wrinkleExtra, setWrinkleExtra] = useState<number>(0)
  const [wrinkleKind, setWrinkleKind] = useState<'bonus_game' | 'winless_double' | 'bonus_picks_only'>('bonus_picks_only')

  // Existing wrinkles list
  const [existing, setExisting] = useState<WrinkleRow[]>([])

  // For "attach game" UI state (keyed by wrinkle.id)
  const [gameOptions, setGameOptions] = useState<Record<string, GameRow[]>>({})
  const [selectedGame, setSelectedGame] = useState<Record<string, string>>({})
  const [attachBusy, setAttachBusy] = useState<Record<string, boolean>>({})

  // App workspace state
  const [pillLight, setPillLight] = useState('#10b981')
  const [pillDark, setPillDark] = useState('#34d399')
  const [unassigned, setUnassigned] = useState<Unassigned[]>([])
  const [assignTarget, setAssignTarget] = useState<string>('')
  const [assignLeagueId, setAssignLeagueId] = useState<string>('')

  function flash(s: string) {
    setMsg(s)
    setTimeout(() => setMsg(''), 3000)
  }

  // ————— bootstrap —————
  useEffect(() => {
    ;(async () => {
      try {
        const lj = await get<{ leagues: League[] }>('/api/my-leagues')
        const ls = lj?.leagues || []
        setLeagues(ls)
        if (!leagueId && ls[0]) setLeagueId(ls[0].id)
        if (!assignLeagueId && ls[0]) setAssignLeagueId(ls[0].id)
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

  // members
  useEffect(() => {
    if (!leagueId) return
    ;(async () => {
      try {
        const j = await get<any>(`/api/admin/league-members?leagueId=${encodeURIComponent(leagueId)}`)
        setMembers(j?.members || [])
      } catch {}
    })()
  }, [leagueId])

  // existing wrinkles for selected league/season
  async function refreshExisting() {
    if (!leagueId || !currentLeague) return
    try {
      const j = await get<any>(`/api/admin/wrinkles?leagueId=${encodeURIComponent(leagueId)}&season=${currentLeague.season}`)
      setExisting(Array.isArray(j?.wrinkles) ? j.wrinkles : [])
    } catch (e: any) {
      flash(e.message || 'Could not load wrinkles')
    }
  }
  useEffect(() => { refreshExisting() }, [leagueId, currentLeague?.season]) // eslint-disable-line react-hooks/exhaustive-deps

  // ————— actions —————
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
    if (!assignTarget || !assignLeagueId) return
    setBusy('assign')
    try {
      await post('/api/admin/assign-to-league', { profileId: assignTarget, leagueId: assignLeagueId })
      setAssignTarget('')
      await refreshUnassigned()
      flash('Player assigned to league.')
    } catch (e: any) { flash(e.message || 'Assignment failed') }
    finally { setBusy('') }
  }

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

  async function createWrinkle() {
    if (!leagueId || !currentLeague || !wrinkleName || !wrinkleWeek) return
    setBusy('wrinkle')
    try {
      await post('/api/admin/wrinkles', {
        leagueId,
        season: currentLeague.season,
        week: wrinkleWeek,
        name: wrinkleName,
        kind: wrinkleKind,
        extraPicks: wrinkleExtra,
        description: wrinkleDesc || '',
        status: 'active',
      })
      setWrinkleName('')
      setWrinkleDesc('')
      setWrinkleExtra(0)
      flash('Wrinkle created.')
      await refreshExisting()
    } catch (e: any) { flash(e.message || 'Wrinkle failed') }
    finally { setBusy('') }
  }

  const [newLeague, setNewLeague] = useState<{ name: string; season: number }>({ name: '', season: new Date().getFullYear() })
  async function _createLeague() {
    if (!newLeague.name) return
    setBusy('league')
    try {
      await post('/api/admin/leagues', { name: newLeague.name, season: newLeague.season })
      setNewLeague({ name: '', season: new Date().getFullYear() })
      flash('League created.')
      const lj = await get<{ leagues: League[] }>('/api/my-leagues')
      const ls = lj?.leagues || []
      setLeagues(ls)
      if (!leagueId && ls[0]) setLeagueId(ls[0].id)
    } catch (e: any) { flash(e.message || 'Create league failed') }
    finally { setBusy('') }
  }

  const [profileQuery, setProfileQuery] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileName, setProfileName] = useState('')
  const [pickWeek, setPickWeek] = useState(1)
  const [pickMember, setPickMember] = useState('')
  const [pickTeam, setPickTeam] = useState('')
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
  async function saveLeaguePillColors() {
    if (!leagueId) return
    setBusy('pill-league')
    try {
      await post('/api/admin/branding', { leagueId, pill_light: pillLight, pill_dark: pillDark })
      flash('League pill colors saved.')
    } catch (e: any) { flash(e.message || 'Save failed') }
    finally { setBusy('') }
  }

  // Helpers: attach game per wrinkle
  async function loadGamesForWrinkle(w: WrinkleRow) {
    if (!currentLeague) return
    const key = `${w.id}`
    try {
      const j = await get<any>(`/api/games-for-week?season=${currentLeague.season}&week=${w.week}`)
      const games: GameRow[] = (j?.games || []).map((x: any) => ({
        id: x.id,
        game_utc: x.game_utc || x.start_time || null,
        status: x.status || null,
        home: {
          id: x.home?.id ?? x.home_team ?? x.homeTeamId ?? x.home_team_id,
          abbr: x.home?.abbreviation ?? x.home_abbr ?? x.homeAbbr ?? x.home?.abbr ?? null,
        },
        away: {
          id: x.away?.id ?? x.away_team ?? x.awayTeamId ?? x.away_team_id,
          abbr: x.away?.abbreviation ?? x.away_abbr ?? x.awayAbbr ?? x.away?.abbr ?? null,
        },
      }))
      setGameOptions((prev) => ({ ...prev, [key]: games }))
      // if none selected yet, choose first unlocked
      if (!selectedGame[key] && games[0]) {
        setSelectedGame((p) => ({ ...p, [key]: games[0].id }))
      }
    } catch (e: any) {
      flash(e?.message || 'Could not load games')
    }
  }

  async function attachGame(wrinkleId: string) {
    const gid = selectedGame[wrinkleId]
    if (!gid) return
    setAttachBusy((p) => ({ ...p, [wrinkleId]: true }))
    try {
      await post('/api/admin/wrinkle-games', { wrinkleId, gameId: gid })
      flash('Game attached to wrinkle.')
      // no need to refetch all; admin/active endpoint reads wrinkle_games when needed
    } catch (e: any) {
      flash(e?.message || 'Attach failed')
    } finally {
      setAttachBusy((p) => ({ ...p, [wrinkleId]: false }))
    }
  }

  // derived
  const leagueOptions = useMemo(
    () => leagues.map(l => <option key={l.id} value={l.id}>{l.name} · {l.season}</option>),
    [leagues]
  )

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5 flex items-center gap-3">
        <h1 className="text-xl font-bold">League Admin</h1>
        <Segmented
          value={mode}
          onChange={(v) => setMode(v as any)}
          items={[
            { label: 'App', value: 'app' },
            { label: 'League', value: 'league' },
          ]}
        />
        <div className="ml-auto flex items-center gap-3">
          <Link className="underline text-sm" href="/">Home</Link>
          <Link className="underline text-sm" href="/picks">Picks</Link>
          <Link className="underline text-sm" href="/standings">Standings</Link>
        </div>
      </header>

      {msg ? <div className="mb-4 text-sm text-emerald-600">{msg}</div> : null}

      {mode === 'app' ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 grid gap-6">
              <Card title="Schedule Sync (App-wide)">
                <div className="flex items-center gap-2">
                  <Button disabled={busy==='sync'} onClick={scheduleSync}>
                    {busy==='sync' ? 'Starting…' : 'Run sync now'}
                  </Button>
                  <span className="text-xs text-neutral-500">Refresh games from your upstream source.</span>
                </div>
              </Card>

              <Card title="Unassigned Players (App-wide)">
                <div className="flex items-center gap-2 mb-3">
                  <Button onClick={refreshUnassigned}>Refresh</Button>
                  <label className="text-sm ml-auto">Assign to league</label>
                  <select className="border rounded px-2 py-1 bg-transparent" value={assignLeagueId} onChange={e => setAssignLeagueId(e.target.value)}>
                    {leagueOptions}
                  </select>
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
                        <div className="flex items-center gap-2">
                          <Button onClick={() => setAssignTarget(u.id)}>
                            {assignTarget === u.id ? 'Selected' : 'Select'}
                          </Button>
                          <Button disabled={!assignTarget || !assignLeagueId || busy==='assign'} onClick={assignPlayer}>
                            {busy==='assign' ? 'Assigning…' : 'Assign →'}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <aside className="lg:col-span-4 grid gap-6">
              <TeamPillColors />
            </aside>
          </div>
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-sm">League</label>
            <select className="border rounded px-2 py-1 bg-transparent" value={leagueId} onChange={e => setLeagueId(e.target.value)}>
              {leagueOptions}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 grid gap-6">
              <Card title="Email Invite (League)">
                <div className="flex gap-2 items-center">
                  <input className="border rounded px-3 py-2 w-full bg-transparent" placeholder="name@email.com"
                         value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                  <Button disabled={!inviteEmail || !leagueId || busy==='invite'} onClick={sendInvite}>
                    {busy==='invite' ? 'Sending…' : 'Send invite'}
                  </Button>
                </div>
                <p className="text-xs text-neutral-500 mt-2">Sends a magic link & associates with the selected league.</p>
              </Card>

              <Card title="Wrinkle Creator (League)">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <input className="border rounded px-3 py-2 md:col-span-2 bg-transparent" placeholder="Name"
                    value={wrinkleName} onChange={e => setWrinkleName(e.target.value)} />
                  <select className="border rounded px-2 py-2 bg-transparent"
                          value={wrinkleKind} onChange={e => setWrinkleKind(e.target.value as any)}>
                    <option value="bonus_picks_only">Bonus picks only</option>
                    <option value="bonus_game">Featured bonus game</option>
                    <option value="winless_double">Winless double</option>
                  </select>
                  <input className="border rounded px-3 py-2 bg-transparent" placeholder="Extra picks (0)" type="number"
                    value={wrinkleExtra} onChange={e => setWrinkleExtra(Number(e.target.value))} />
                  <input className="border rounded px-3 py-2 bg-transparent" placeholder="Week" type="number"
                    value={wrinkleWeek} onChange={e => setWrinkleWeek(Number(e.target.value))} />
                </div>
                <textarea className="border rounded px-3 py-2 w-full mt-2 bg-transparent" placeholder="Description (optional)"
                  value={wrinkleDesc} onChange={e => setWrinkleDesc(e.target.value)} />
                <div className="mt-2">
                  <Button disabled={!leagueId || !wrinkleName || busy==='wrinkle'} onClick={createWrinkle}>
                    {busy==='wrinkle' ? 'Creating…' : 'Create wrinkle'}
                  </Button>
                </div>
              </Card>

              {/* Existing Wrinkles with Attach Game for bonus_game */}
              <Card title={`Existing Wrinkles — ${currentLeague?.season ?? ''}`}>
                <div className="mb-2">
                  <Button onClick={refreshExisting}>Refresh</Button>
                </div>
                {existing.length === 0 ? (
                  <div className="text-sm text-neutral-500">None yet for this season.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-neutral-500">
                        <tr>
                          <th className="py-2 pr-4">Week</th>
                          <th className="py-2 pr-4">Kind</th>
                          <th className="py-2 pr-4">Name</th>
                          <th className="py-2 pr-4">Extra</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4">Attach game</th>
                          <th className="py-2 pr-4">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {existing.map(w => {
                          const key = w.id
                          const isBonus = (w.kind || '').toLowerCase() === 'bonus_game'
                          const games = gameOptions[key] || []
                          return (
                            <tr key={w.id} className="border-t border-neutral-200 dark:border-neutral-800 align-top">
                              <td className="py-2 pr-4">Week {w.week}</td>
                              <td className="py-2 pr-4">{w.kind}</td>
                              <td className="py-2 pr-4">{w.name}</td>
                              <td className="py-2 pr-4">{w.extra_picks || 0}</td>
                              <td className="py-2 pr-4">{w.status}</td>
                              <td className="py-2 pr-4">
                                {isBonus ? (
                                  <div className="flex gap-2 items-center">
                                    <Button
                                      className="text-xs"
                                      onClick={() => loadGamesForWrinkle(w)}
                                    >
                                      Load games
                                    </Button>
                                    {games.length > 0 && (
                                      <>
                                        <select
                                          className="border rounded px-2 py-1 bg-transparent"
                                          value={selectedGame[key] || ''}
                                          onChange={(e) =>
                                            setSelectedGame((p) => ({ ...p, [key]: e.target.value }))
                                          }
                                        >
                                          {games.map(g => (
                                            <option key={g.id} value={g.id}>
                                              {`${g.home?.abbr || 'HOME'} @ ${g.away?.abbr || 'AWAY'} · ${g.game_utc ? new Date(g.game_utc).toLocaleString() : ''}`}
                                            </option>
                                          ))}
                                        </select>
                                        <Button
                                          disabled={!selectedGame[key] || !!attachBusy[key]}
                                          onClick={() => attachGame(key)}
                                          className="text-xs"
                                        >
                                          {attachBusy[key] ? 'Saving…' : 'Save'}
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-neutral-400">—</span>
                                )}
                              </td>
                              <td className="py-2 pr-4">{w.created_at ? new Date(w.created_at).toLocaleString() : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card title="Create a League">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input className="border rounded px-3 py-2 bg-transparent" placeholder="League name"
                    value={newLeague.name} onChange={e => setNewLeague(v => ({ ...v, name: e.target.value }))}/>
                  <input className="border rounded px-3 py-2 bg-transparent" placeholder="Season" type="number"
                    value={newLeague.season} onChange={e => setNewLeague(v => ({ ...v, season: Number(e.target.value) }))}/>
                  <Button disabled={!newLeague.name || busy==='league'} onClick={_createLeague}>
                    {busy==='league' ? 'Creating…' : 'Create'}
                  </Button>
                </div>
              </Card>
            </div>

            <aside className="lg:col-span-4 grid gap-6">
              <Card title="Pill Colors (League override)">
                <div className="grid grid-cols-2 gap-3 items-center">
                  <label className="text-sm">Light</label>
                  <input type="color" value={pillLight} onChange={e => setPillLight(e.target.value)} className="w-16 h-9 p-0 border rounded"/>
                  <label className="text-sm">Dark</label>
                  <input type="color" value={pillDark} onChange={e => setPillDark(e.target.value)} className="w-16 h-9 p-0 border rounded"/>
                </div>
                <div className="mt-3">
                  <Button disabled={!leagueId || busy==='pill-league'} onClick={saveLeaguePillColors}>
                    {busy==='pill-league' ? 'Saving…' : 'Save for this league'}
                  </Button>
                </div>
              </Card>

              <Card title="Player Name / Profile Editor (League)">
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

              <Card title="Manual Pick Input (League)">
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
        </>
      )}
    </main>
  )
}
