'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Team = {
  id: string
  abbreviation: string | null
  short_name: string | null
  name: string | null
  color_primary: string | null
  color_secondary: string | null
  color_tertiary: string | null
  color_quaternary: string | null
  ui_light_color_key: string | null
  ui_dark_color_key: string | null
  color_pref_light: string | null
  color_pref_dark: string | null
}

const KEY_OPTIONS = [
  'color_primary',
  'color_secondary',
  'color_tertiary',
  'color_quaternary',
]

function swatch(hex?: string | null) {
  const h = (hex && /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(hex)) ? hex : '#888888'
  return <span className="inline-block w-4 h-4 rounded border align-middle mr-1" style={{ background: h }} />
}

function Chip({label, color}:{label: string; color: string}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-xl border px-3 py-1 text-xs font-semibold"
      style={{ borderColor: color, color }}>
      {label}
    </span>
  )
}

function pickHex(t: Team, key: string | null | undefined): string | null {
  if (!key) return null
  const v = (t as any)[key]
  return typeof v === 'string' ? v : null
}

function resolvedLightHex(t: Team): string {
  return (t.color_pref_light?.trim()) || pickHex(t, t.ui_light_color_key) || t.color_primary || '#6b7280'
}

function resolvedDarkHex(t: Team): string {
  return (t.color_pref_dark?.trim()) || pickHex(t, t.ui_dark_color_key) || t.color_secondary || '#6b7280'
}

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [msg, setMsg] = useState('')

  async function load() {
    setMsg('')
    const j = await fetch('/api/admin/teams/list', { cache: 'no-store' }).then(r => r.json())
    if (!j?.ok) { setMsg(j?.error || 'Failed to load'); return }
    setTeams(j.teams || [])
  }
  useEffect(() => { load() }, [])

  async function save(t: Team) {
    setMsg('')
    const r = await fetch('/api/admin/teams/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: t.id,
        ui_light_color_key: t.ui_light_color_key,
        ui_dark_color_key: t.ui_dark_color_key,
        color_pref_light: t.color_pref_light,
        color_pref_dark: t.color_pref_dark,
      })
    })
    const j = await r.json().catch(() => ({}))
    if (r.ok && j?.ok !== false) setMsg(`Saved ${t.abbreviation || t.short_name || t.name}`)
    else setMsg(j?.error || 'Save failed')
  }

  const sorted = useMemo(() => {
    return [...teams].sort((a,b) => (a.abbreviation || '').localeCompare(b.abbreviation || ''))
  }, [teams])

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-xl font-bold mb-4">Teams — UI Colors</h1>
      <p className="text-sm text-neutral-600 mb-4">
        Pick which palette key the UI uses in <strong>Light</strong> and <strong>Dark</strong> modes,
        or override with a custom hex. (Logos ignored for now.)
      </p>

      {msg && <div className="text-xs mb-3">{msg}</div>}

      {sorted.length === 0 ? <div className="text-sm text-neutral-500">Loading…</div> : (
        <div className="grid gap-3">
          {sorted.map(t => {
            const lightHex = resolvedLightHex(t)
            const darkHex = resolvedDarkHex(t)
            return (
              <div key={t.id} className="rounded-xl border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {t.abbreviation || t.short_name || t.name || 'Team'}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Preview:</span>
                    <Chip label={(t.abbreviation || '—') + ' • Light'} color={lightHex}/>
                    <Chip label={(t.abbreviation || '—') + ' • Dark'} color={darkHex}/>
                    <button
                      className="rounded-md border px-3 py-1 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
                      onClick={() => save(t)}
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <div className="font-semibold text-xs mb-2">Light mode</div>
                    <div className="flex items-center gap-2 mb-2">
                      {swatch(pickHex(t, t.ui_light_color_key))}
                      <label className="flex items-center gap-2">
                        <span className="w-24 text-xs text-neutral-500">Color key</span>
                        <select
                          className="border rounded px-2 py-1 bg-transparent"
                          value={t.ui_light_color_key || ''}
                          onChange={e => setTeams(ts => ts.map(x => x.id === t.id ? { ...x, ui_light_color_key: e.target.value || null } : x))}
                        >
                          <option value="">(default: color_primary)</option>
                          {KEY_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      {swatch(t.color_pref_light)}
                      <label className="flex items-center gap-2">
                        <span className="w-24 text-xs text-neutral-500">Hex override</span>
                        <input
                          type="color"
                          value={/^\#[0-9a-f]{3,6}$/i.test(t.color_pref_light || '') ? (t.color_pref_light as string) : '#888888'}
                          onChange={e => setTeams(ts => ts.map(x => x.id === t.id ? { ...x, color_pref_light: e.target.value } : x))}
                        />
                        <input
                          className="border rounded px-2 py-1 bg-transparent w-32"
                          placeholder="#RRGGBB"
                          value={t.color_pref_light || ''}
                          onChange={e => setTeams(ts => ts.map(x => x.id === t.id ? { ...x, color_pref_light: e.target.value } : x))}
                        />
                        <button
                          type="button"
                          className="text-xs underline"
                          onClick={() => setTeams(ts => ts.map(x => x.id === t.id ? { ...x, color_pref_light: null } : x))}
                        >
                          Clear
                        </button>
                      </label>
                    </div>
                  </div>

                  <div className="rounded-lg border p-3">
                    <div className="font-semibold text-xs mb-2">Dark mode</div>
                    <div className="flex items-center gap-2 mb-2">
                      {swatch(pickHex(t, t.ui_dark_color_key))}
                      <label className="flex items-center gap-2">
                        <span className="w-24 text-xs text-neutral-500">Color key</span>
                        <select
                          className="border rounded px-2 py-1 bg-transparent"
                          value={t.ui_dark_color_key || ''}
                          onChange={e => setTeams(ts => ts.map(x => x.id === t.id ? { ...x, ui_dark_color_key: e.target.value || null } : x))}
                        >
                          <option value="">(default: color_secondary)</option>
                          {KEY_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      {swatch(t.color_pref_dark)}
                      <label className="flex items-center gap-2">
                        <span className="w-24 text-xs text-neutral-500">Hex override</span>
                        <input
                          type="color"
                          value={/^\#[0-9a-f]{3,6}$/i.test(t.color_pref_dark || '') ? (t.color_pref_dark as string) : '#888888'}
                          onChange={e => setTeams(ts => ts.map(x => x.id === t.id ? { ...x, color_pref_dark: e.target.value } : x))}
                        />
                        <input
                          className="border rounded px-2 py-1 bg-transparent w-32"
                          placeholder="#RRGGBB"
                          value={t.color_pref_dark || ''}
                          onChange={e => setTeams(ts => ts.map(x => x.id === t.id ? { ...x, color_pref_dark: e.target.value } : x))}
                        />
                        <button
                          type="button"
                          className="text-xs underline"
                          onClick={() => setTeams(ts => ts.map(x => x.id === t.id ? { ...x, color_pref_dark: null } : x))}
                        >
                          Clear
                        </button>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-xs text-neutral-500">
                  Base palette: {['color_primary','color_secondary','color_tertiary','color_quaternary'].map(k => {
                    const v = (t as any)[k] as string | null
                    return <span key={k} className="mr-3">{swatch(v)}{k}: {v || '—'}</span>
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-4">
        <Link href="/admin" className="underline text-sm">← Back to Admin</Link>
      </div>
    </main>
  )
}
