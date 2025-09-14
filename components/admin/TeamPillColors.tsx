'use client'

import { useEffect, useMemo, useState } from 'react'

type TeamRow = {
  id: string
  name?: string | null
  abbreviation?: string | null
  color_primary?: string | null
  color_secondary?: string | null
  color_tertiary?: string | null
  color_quaternary?: string | null
  ui_light_color_key?: keyof TeamRow | null
  ui_dark_color_key?: keyof TeamRow | null
}

type TeamMapResponse = { teams: Record<string, TeamRow> }

async function get<T = any>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}
async function post<T = any>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
  if (!r.ok) throw new Error(data?.error || `${r.status} ${r.statusText}`)
  return data
}

const FRIENDLY: Record<string, string> = {
  color_primary: 'Primary',
  color_secondary: 'Secondary',
  color_tertiary: 'Tertiary',
  color_quaternary: 'Quaternary',
}

export default function TeamPillColors() {
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [teamId, setTeamId] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  // selected team + available color keys
  const team = useMemo(() => teams.find(t => t.id === teamId) || null, [teams, teamId])
  const colorOptions = useMemo(() => {
    if (!team) return [] as { key: keyof TeamRow; label: string; hex: string }[]
    const keys: (keyof TeamRow)[] = [
      'color_primary',
      'color_secondary',
      'color_tertiary',
      'color_quaternary',
    ]
    return keys
      .filter(k => typeof team[k] === 'string' && (team[k] as string)?.startsWith('#'))
      .map(k => ({
        key: k,
        label: FRIENDLY[k as string] || (k as string),
        hex: (team[k] as string)!,
      }))
  }, [team])

  // chosen light/dark keys (default from team.ui_* or sensible fallbacks)
  const [lightKey, setLightKey] = useState<keyof TeamRow | ''>('')
  const [darkKey, setDarkKey] = useState<keyof TeamRow | ''>('')

  useEffect(() => {
    ;(async () => {
      try {
        const tm = await get<TeamMapResponse>('/api/team-map')
        const arr = Object.values(tm?.teams || {})
        arr.sort((a, b) => (a.abbreviation || '').localeCompare(b.abbreviation || ''))
        setTeams(arr)
        if (!teamId && arr[0]) setTeamId(arr[0].id)
      } catch (e: any) {
        setMsg(`Failed to load team map: ${e.message || e}`)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // when team changes, seed keys from existing prefs or fall back
  useEffect(() => {
    if (!team) return
    const defaultLight =
      (team.ui_light_color_key as keyof TeamRow | null) ||
      (team.color_primary ? 'color_primary' : (colorOptions[0]?.key ?? ''))
    const defaultDark =
      (team.ui_dark_color_key as keyof TeamRow | null) ||
      (team.color_secondary ? 'color_secondary' : (colorOptions[1]?.key ?? colorOptions[0]?.key ?? ''))
    setLightKey(defaultLight || '')
    setDarkKey(defaultDark || '')
  }, [team, colorOptions])

  const lightHex = team && lightKey ? ((team[lightKey] as string) || '') : ''
  const darkHex = team && darkKey ? ((team[darkKey] as string) || '') : ''

  function flash(s: string) {
    setMsg(s)
    setTimeout(() => setMsg(''), 2500)
  }

  async function save() {
    if (!team || !lightKey || !darkKey) return
    setBusy(true)
    try {
      // Save the *keys*, not raw colors, so the DB persists to ui_*_color_key fields.
      // Endpoint name can match whatever you already had wired up.
      await post('/api/admin/team-pill-colors', {
        teamId: team.id,
        ui_light_color_key: lightKey,
        ui_dark_color_key: darkKey,
      })
      flash('Saved!')
    } catch (e: any) {
      flash(e.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Team Pill Colors (App-wide)</h2>
        <div className="text-sm text-neutral-500">{msg}</div>
      </header>

      {/* Team selector */}
      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm">Team</label>
        <select
          className="border rounded px-2 py-1 bg-transparent"
          value={teamId}
          onChange={e => setTeamId(e.target.value)}
        >
          {teams.map(t => (
            <option key={t.id} value={t.id}>
              {(t.abbreviation || t.name || t.id) as string}
            </option>
          ))}
        </select>
      </div>

      {/* Light / Dark choose from available team colors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
          <label className="text-sm">Light</label>
          <select
            className="border rounded px-2 py-2 bg-transparent"
            value={lightKey}
            onChange={e => setLightKey(e.target.value as keyof TeamRow)}
          >
            {colorOptions.map(opt => (
              <option key={opt.key as string} value={opt.key as string}>
                {opt.label} ({opt.hex})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
          <label className="text-sm">Dark</label>
          <select
            className="border rounded px-2 py-2 bg-transparent"
            value={darkKey}
            onChange={e => setDarkKey(e.target.value as keyof TeamRow)}
          >
            {colorOptions.map(opt => (
              <option key={opt.key as string} value={opt.key as string}>
                {opt.label} ({opt.hex})
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 md:justify-end">
          <span className="px-3 py-2 rounded-full border" style={{ background: lightHex }}>
            Light preview
          </span>
          <span className="px-3 py-2 rounded-full border" style={{ background: darkHex }}>
            Dark preview
          </span>
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={save}
          disabled={!team || !lightKey || !darkKey || busy}
          className="px-3 py-2 rounded-xl border font-medium border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save colors'}
        </button>
      </div>
    </section>
  )
}
