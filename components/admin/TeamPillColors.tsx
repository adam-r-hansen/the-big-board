// components/admin/TeamPillColors.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import TeamPill, { TeamShape } from '@/components/ui/TeamPill'

type TeamRow = {
  id: string
  abbreviation?: string | null
  name?: string | null
  color_primary?: string | null
  color_secondary?: string | null
  color_tertiary?: string | null
  color_quaternary?: string | null
  ui_light_color_key?: string | null
  ui_dark_color_key?: string | null
  color_pref_light?: string | null
  color_pref_dark?: string | null
}

type ColorKey =
  | 'color_primary'
  | 'color_secondary'
  | 'color_tertiary'
  | 'color_quaternary'

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
  const text = await res.text()
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
  if (!res.ok) throw new Error(data?.error || `${res.status} ${res.statusText}`)
  return data
}

export default function TeamPillColors() {
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [teamId, setTeamId] = useState<string>('')

  const [lightKey, setLightKey] = useState<ColorKey | ''>('')
  const [darkKey, setDarkKey] = useState<ColorKey | ''>('')

  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  function flash(s: string) {
    setMsg(s)
    setTimeout(() => setMsg(''), 2500)
  }

  async function loadTeams(preserveId?: string) {
    const tm = await get<any>('/api/team-map')
    const arr = Object.values<TeamRow>(tm?.teams || {})
    arr.sort((a, b) => (a.abbreviation || '').localeCompare(b.abbreviation || ''))
    setTeams(arr)
    if (preserveId) {
      setTeamId(preserveId)
    } else if (!teamId && arr[0]) {
      setTeamId(arr[0].id)
    }
  }

  // fetch team map once
  useEffect(() => {
    ;(async () => {
      try {
        await loadTeams()
      } catch (e: any) {
        flash(`Load failed: ${e.message || e}`)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const team = useMemo(() => teams.find(t => t.id === teamId), [teamId, teams])

  // when team changes, seed keys from stored prefs or sensible defaults
  useEffect(() => {
    const t = team
    if (!t) return
    const available = colorOptionsForTeam(t).map(o => o.value)
    const defaultLight =
      (t.ui_light_color_key as ColorKey | null) ||
      (t.color_pref_light ? nearestKeyForHex(t, t.color_pref_light) : null) ||
      (available.includes('color_primary') ? 'color_primary' : available[0] || '')
    const defaultDark =
      (t.ui_dark_color_key as ColorKey | null) ||
      (t.color_pref_dark ? nearestKeyForHex(t, t.color_pref_dark) : null) ||
      (available.includes('color_secondary') ? 'color_secondary' : available[0] || '')
    setLightKey(defaultLight || '')
    setDarkKey(defaultDark || '')
  }, [team])

  const lightHex = useMemo(
    () => (team && lightKey ? (team as any)[lightKey] : '#ffffff') || '#ffffff',
    [team, lightKey]
  )
  const darkHex = useMemo(
    () => (team && darkKey ? (team as any)[darkKey] : '#111827') || '#111827',
    [team, darkKey]
  )

  // Build a preview team that reflects the current selections (without needing to save)
  const previewTeam = useMemo(
    () =>
      team
        ? ({
            ...team,
            ui_light_color_key: lightKey || team.ui_light_color_key,
            ui_dark_color_key: darkKey || team.ui_dark_color_key,
          } as TeamShape)
        : null,
    [team, lightKey, darkKey]
  )

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
      .map(p => ({
        value: p.key,
        label: `${p.label} (${p.hex})`,
        hex: p.hex!,
      }))
  }

  function nearestKeyForHex(t: TeamRow, hex: string): ColorKey | null {
    const opts = colorOptionsForTeam(t)
    const target = hex.toLowerCase()
    const direct = opts.find(o => o.hex.toLowerCase() === target)
    if (direct) return direct.value as ColorKey
    return (opts[0]?.value as ColorKey) || null
  }

  async function save() {
    if (!team || !lightKey || !darkKey) return
    setBusy(true)
    try {
      // preferred endpoint
      await post('/api/admin/team-pill-colors', {
        teamId: team.id,
        ui_light_color_key: lightKey,
        ui_dark_color_key: darkKey,
      })
      flash('Saved.')
    } catch (e1: any) {
      // graceful fallback to branding if your backend uses that
      try {
        await post('/api/admin/branding', {
          teamId: team.id,
          ui_light_color_key: lightKey,
          ui_dark_color_key: darkKey,
        })
        flash('Saved.')
      } catch (e2: any) {
        flash(e1?.message || e2?.message || 'Save failed')
      }
    } finally {
      // Make sure the new keys are reflected if user navigates away/back.
      loadTeams(team?.id).catch(() => {})
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
            style={{ background: lightHex }}
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
            style={{ background: darkHex }}
          />
        </div>
      </div>

      {/* Universal pill previews */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {previewTeam ? (
          <>
            <TeamPill team={previewTeam} mode="light" size="lg">Light preview</TeamPill>
            <TeamPill team={previewTeam} mode="dark" size="lg">Dark preview</TeamPill>
          </>
        ) : null}
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
