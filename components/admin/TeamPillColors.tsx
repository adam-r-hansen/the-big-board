// components/admin/TeamPillColors.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import TeamPill, { TeamShape } from '@/components/ui/TeamPill'

type ColorKey = 'color_primary' | 'color_secondary' | 'color_tertiary' | 'color_quaternary'

type TeamRow = TeamShape & {
  // all the color fields may be null in some rows
  color_primary?: string | null
  color_secondary?: string | null
  color_tertiary?: string | null
  color_quaternary?: string | null
}

function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ')
}

async function get<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function post<T = any>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const txt = await res.text()
  let data: any = {}
  try { data = txt ? JSON.parse(txt) : {} } catch { data = { raw: txt } }
  if (!res.ok) throw new Error(data?.error || `${res.status} ${res.statusText}`)
  return data
}

export default function TeamPillColors() {
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [teamId, setTeamId] = useState<string>('')

  // the selected keys to *preview* and to *save*
  const [lightKey, setLightKey] = useState<ColorKey | ''>('')
  const [darkKey, setDarkKey] = useState<ColorKey | ''>('')

  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  function flash(s: string) {
    setMsg(s)
    setTimeout(() => setMsg(''), 2200)
  }

  // Load all teams (palette colors) one time
  useEffect(() => {
    ;(async () => {
      try {
        // team-map already returns every team + colors (your existing endpoint)
        const tm = await get<any>('/api/team-map')
        const arr = Object.values<TeamRow>(tm?.teams || {})
        arr.sort((a, b) => (a.abbreviation || '').localeCompare(b.abbreviation || ''))
        setTeams(arr)
        if (arr[0]) setTeamId(arr[0].id)
      } catch (e: any) {
        flash(`Load failed: ${e.message || e}`)
      }
    })()
  }, [])

  // helper to read saved keys for a specific team from admin API
  async function loadSavedKeys(tid: string) {
    try {
      const j = await get<any>(`/api/admin/team-pill-colors?teamId=${encodeURIComponent(tid)}`)
      // shape: { teamId, ui_light_color_key, ui_dark_color_key } or {}
      const lk = j?.ui_light_color_key as ColorKey | undefined
      const dk = j?.ui_dark_color_key as ColorKey | undefined
      if (lk) setLightKey(lk)
      if (dk) setDarkKey(dk)
      // also mirror into local teams[] so previews keep working when switching around
      if (lk || dk) {
        setTeams(prev =>
          prev.map(t => (t.id === tid ? { ...t, ui_light_color_key: lk ?? t.ui_light_color_key, ui_dark_color_key: dk ?? t.ui_dark_color_key } : t))
        )
      }
    } catch {
      // silently ignore; we’ll fall back to defaults below
    }
  }

  // When team changes, seed keys from SAVED -> fallback to sensible defaults
  useEffect(() => {
    const t = teams.find(x => x.id === teamId)
    if (!t) return

    // seed defaults
    const options = colorOptionsForTeam(t)
    let lk: ColorKey | '' =
      (t.ui_light_color_key as ColorKey | null) ??
      (options.find(o => o.value === 'color_primary')?.value as ColorKey | undefined) ??
      (options[0]?.value as ColorKey | undefined) ??
      ''
    let dk: ColorKey | '' =
      (t.ui_dark_color_key as ColorKey | null) ??
      (options.find(o => o.value === 'color_secondary')?.value as ColorKey | undefined) ??
      (options[0]?.value as ColorKey | undefined) ??
      ''
    setLightKey(lk || '')
    setDarkKey(dk || '')

    // then fetch saved keys from admin API to override if present
    loadSavedKeys(t.id)
  }, [teamId, teams])

  const team = useMemo(() => teams.find(t => t.id === teamId), [teamId, teams])

  // compute hex for display next to selects
  const lightHex = useMemo(() => (team && lightKey ? (team as any)[lightKey] : '') || '', [team, lightKey])
  const darkHex  = useMemo(() => (team && darkKey  ? (team as any)[darkKey ] : '') || '', [team, darkKey])

  // Build an ephemeral team object with the *selected* keys so <TeamPill> previews correctly.
  const previewTeam: TeamShape | null = useMemo(() => {
    if (!team) return null
    return {
      ...team,
      ui_light_color_key: (lightKey || null) as any,
      ui_dark_color_key: (darkKey || null) as any,
    }
  }, [team, lightKey, darkKey])

  function colorOptionsForTeam(t?: TeamRow) {
    if (!t) return []
    const pairs: { key: ColorKey; label: string; hex?: string | null }[] = [
      { key: 'color_primary', label: 'Primary', hex: t.color_primary },
      { key: 'color_secondary', label: 'Secondary', hex: t.color_secondary },
      { key: 'color_tertiary', label: 'Tertiary', hex: t.color_tertiary },
      { key: 'color_quaternary', label: 'Quaternary', hex: t.color_quaternary },
    ]
    return pairs
      .filter(p => p.hex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(p.hex))
      .map(p => ({ value: p.key, label: `${p.label} (${p.hex})`, hex: p.hex! }))
  }

  async function save() {
    if (!team || !lightKey || !darkKey) return
    setBusy(true)
    try {
      // canonical admin endpoint you added
      await post('/api/admin/team-pill-colors', {
        teamId: team.id,
        ui_light_color_key: lightKey,
        ui_dark_color_key: darkKey,
      })
      // reflect immediately in local state, so it persists when navigating/swapping teams
      setTeams(prev =>
        prev.map(t =>
          t.id === team.id
            ? { ...t, ui_light_color_key: lightKey, ui_dark_color_key: darkKey }
            : t
        )
      )
      flash('Saved.')
    } catch (e1: any) {
      // optional fallback to branding route if your backend maps it there
      try {
        await post('/api/admin/branding', {
          teamId: team.id,
          ui_light_color_key: lightKey,
          ui_dark_color_key: darkKey,
        })
        setTeams(prev =>
          prev.map(t =>
            t.id === team.id
              ? { ...t, ui_light_color_key: lightKey, ui_dark_color_key: darkKey }
              : t
          )
        )
        flash('Saved.')
      } catch (e2: any) {
        flash(e1?.message || e2?.message || 'Save failed')
      }
    } finally {
      setBusy(false)
    }
  }

  const options = colorOptionsForTeam(team)

  return (
    <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Team Pill Colors (App-wide)</h2>
      </header>

      {msg ? <div className="mb-3 text-sm text-emerald-600">{msg}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-3 items-center">
        <label className="text-sm">Team</label>
        <select
          className="border rounded px-2 py-2 bg-transparent"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
        >
          {teams.map(t => (
            <option key={t.id} value={t.id}>
              {(t.abbreviation || t.name || t.id).toString()}
            </option>
          ))}
        </select>

        <label className="text-sm">Light</label>
        <div className="flex items-center gap-3">
          <select
            className="border rounded px-2 py-2 bg-transparent w-full"
            value={lightKey}
            onChange={(e) => setLightKey(e.target.value as ColorKey)}
          >
            {options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span
            className="inline-block w-8 h-8 rounded border"
            title={lightHex}
            style={{ background: lightHex || 'transparent' }}
          />
        </div>

        <label className="text-sm">Dark</label>
        <div className="flex items-center gap-3">
          <select
            className="border rounded px-2 py-2 bg-transparent w-full"
            value={darkKey}
            onChange={(e) => setDarkKey(e.target.value as ColorKey)}
          >
            {options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span
            className="inline-block w-8 h-8 rounded border"
            title={darkHex}
            style={{ background: darkHex || 'transparent' }}
          />
        </div>
      </div>

      {/* Previews using the shared UI pill (mono look) */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <TeamPill team={previewTeam} mode="light" size="lg" />
        <TeamPill team={previewTeam} mode="dark" size="lg" />
      </div>

      <div className="mt-4">
        <button
          onClick={save}
          disabled={busy || !team || !lightKey || !darkKey}
          className={cx(
            'px-3 py-2 rounded-xl border font-medium',
            'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800',
            busy && 'opacity-50 cursor-not-allowed'
          )}
        >
          {busy ? 'Saving…' : 'Save colors'}
        </button>
      </div>
    </section>
  )
}
