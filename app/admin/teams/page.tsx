'use client'

import { useEffect, useMemo, useState } from 'react'

type Team = {
  id: string
  name: string
  abbreviation: string
  logo?: string|null
  logo_dark?: string|null
  color_primary?: string|null
  color_secondary?: string|null
  color_tertiary?: string|null
  color_quaternary?: string|null
  color_pref_light?: 'primary'|'secondary'|'tertiary'|'quaternary'|null
  color_pref_dark?:  'primary'|'secondary'|'tertiary'|'quaternary'|null
}

function Swatch({ hex }: { hex?: string|null }) {
  return (
    <div className="h-5 w-5 rounded border border-neutral-300 dark:border-neutral-700"
         style={{ background: hex || 'transparent' }} title={hex || ''}/>
  )
}

function Label({children}:{children: React.ReactNode}) {
  return <div className="text-xs text-neutral-500">{children}</div>
}

export default function AdminTeamsPage() {
  const [rows, setRows] = useState<Team[]>([])
  const [saving, setSaving] = useState<string|null>(null)
  const [err, setErr] = useState<string>('')

  async function load() {
    setErr('')
    const res = await fetch('/api/admin/teams')
    const j = await res.json()
    if (!res.ok) { setErr(j.error || 'Error'); return }
    setRows(j.teams || [])
  }
  useEffect(()=>{ load() }, [])

  async function save(id: string, patch: Partial<Team>) {
    setErr('')
    setSaving(id)
    const res = await fetch('/api/admin/teams', {
      method:'PATCH', headers:{'content-type':'application/json'},
      body: JSON.stringify({ id, updates: patch })
    })
    const j = await res.json()
    setSaving(null)
    if (!res.ok) { setErr(j.error || 'Save failed'); return }
    setRows(prev => prev.map(t => t.id===id ? { ...t, ...patch } : t))
  }

  function CellInput({team, field, placeholder}:{team:Team; field:keyof Team; placeholder?:string}) {
    const [val, setVal] = useState<string>(String(team[field] || ''))
    useEffect(()=>{ setVal(String(team[field] || '')) }, [team[field]])
    return (
      <div className="flex items-center gap-2">
        <input
          className="h-8 w-full rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
          placeholder={placeholder}
          value={val}
          onChange={e=>setVal(e.target.value)}
          onBlur={()=>{ if (val !== (team[field]||'')) save(team.id, { [field]: val } as any) }}
        />
        {String(field).startsWith('color_') && <Swatch hex={val}/>}
      </div>
    )
  }

  function PrefSelect({team, field}:{team:Team; field:'color_pref_light'|'color_pref_dark'}) {
    const [val, setVal] = useState<string>(team[field] || '')
    useEffect(()=>{ setVal(team[field] || '') }, [team[field]])
    return (
      <select
        className="h-8 w-full rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
        value={val}
        onChange={e=>{ setVal(e.target.value); save(team.id, { [field]: (e.target.value||null) } as any) }}
      >
        <option value="">(auto)</option>
        <option value="primary">primary</option>
        <option value="secondary">secondary</option>
        <option value="tertiary">tertiary</option>
        <option value="quaternary">quaternary</option>
      </select>
    )
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin · Teams</h1>
        <button onClick={load} className="rounded border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm">Reload</button>
      </div>

      {err && <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
        {err}
      </div>}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-900/40">
            <tr className="text-left">
              <th className="p-2">Logo</th>
              <th className="p-2">Abbr</th>
              <th className="p-2">Name</th>
              <th className="p-2">Light pref</th>
              <th className="p-2">Dark pref</th>
              <th className="p-2">Primary</th>
              <th className="p-2">Secondary</th>
              <th className="p-2">Tertiary</th>
              <th className="p-2">Quaternary</th>
              <th className="p-2">Logo URL</th>
              <th className="p-2">Logo (dark)</th>
              <th className="p-2 w-[110px]">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id} className="border-t border-neutral-200 dark:border-neutral-800 align-top">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    {t.logo && <img src={t.logo} alt="" width={24} height={24} className="rounded" />}
                    {t.logo_dark && <img src={t.logo_dark} alt="" width={24} height={24} className="rounded ring-1 ring-neutral-300/50" />}
                  </div>
                </td>
                <td className="p-2">
                  <CellInput team={t} field="abbreviation" placeholder="PHI"/>
                </td>
                <td className="p-2">
                  <CellInput team={t} field="name" placeholder="Philadelphia Eagles"/>
                </td>
                <td className="p-2"><PrefSelect team={t} field="color_pref_light"/></td>
                <td className="p-2"><PrefSelect team={t} field="color_pref_dark"/></td>
                <td className="p-2"><CellInput team={t} field="color_primary" placeholder="#004C54"/></td>
                <td className="p-2"><CellInput team={t} field="color_secondary" placeholder="#A5ACAF"/></td>
                <td className="p-2"><CellInput team={t} field="color_tertiary" placeholder="#000000"/></td>
                <td className="p-2"><CellInput team={t} field="color_quaternary" placeholder="#FFFFFF"/></td>
                <td className="p-2"><CellInput team={t} field="logo" placeholder="https://…"/></td>
                <td className="p-2"><CellInput team={t} field="logo_dark" placeholder="https://…"/></td>
                <td className="p-2">
                  {saving===t.id ? <span className="text-neutral-500">Saving…</span> : <span className="text-neutral-400">—</span>}
                </td>
              </tr>
            ))}
            {rows.length===0 && (
              <tr><td className="p-4 text-neutral-500" colSpan={12}>No teams found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-500">
        Color contrast is automatically checked on UI surfaces when rendering cards. Aim for ≥4.5:1 for body text (≥3:1 for large UI elements). 
      </p>
    </main>
  )
}
