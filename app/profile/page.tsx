// app/profile/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Profile = {
  id: string
  email: string | null
  display_name: string | null
  preferred_color: string | null
}

type Team = {
  id: string
  name: string
  abbreviation: string
  color_primary: string | null
  color_secondary: string | null
  color_tertiary: string | null
  color_quaternary: string | null
}

type ColorOption = {
  key: 'primary' | 'secondary' | 'tertiary' | 'quaternary'
  label: string
  hex: string | null
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  
  // Color preference state
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [selectedColor, setSelectedColor] = useState<string>('#000000')

  // Load profile
  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      setOk(false)
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' })
        if (res.status === 401) {
          setError('Please sign in to edit your profile.')
          return
        }
        const data = await res.json()
        if (mounted) {
          setProfile(data.profile ?? null)
          setDisplayName(data.profile?.display_name ?? '')
          setSelectedColor(data.profile?.preferred_color || '#000000')
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  // Load teams
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/team-map', { cache: 'no-store' })
        const data = await res.json()
        const teamMap = data.teams || {}
        const teamArray = Object.values(teamMap) as Team[]
        // Sort alphabetically by name
        teamArray.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        setTeams(teamArray)
      } catch (e) {
        console.error('Failed to load teams:', e)
      }
    })()
  }, [])

  // Get color options for selected team
  const colorOptions: ColorOption[] = (() => {
    if (!selectedTeamId) return []
    const team = teams.find(t => t.id === selectedTeamId)
    if (!team) return []
    
    const options: ColorOption[] = [
      { key: 'primary' as const, label: 'Primary', hex: team.color_primary },
      { key: 'secondary' as const, label: 'Secondary', hex: team.color_secondary },
      { key: 'tertiary' as const, label: 'Tertiary', hex: team.color_tertiary },
      { key: 'quaternary' as const, label: 'Quaternary', hex: team.color_quaternary },
    ]
    
    return options.filter(opt => opt.hex) // Only show colors that exist
  })()

  // When team changes, auto-select primary color if available
  useEffect(() => {
    if (selectedTeamId && colorOptions.length > 0) {
      const primaryOption = colorOptions.find(opt => opt.key === 'primary')
      if (primaryOption?.hex) {
        setSelectedColor(primaryOption.hex)
      }
    }
  }, [selectedTeamId])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setOk(false)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          display_name: displayName,
          preferred_color: selectedColor 
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Save failed')
      }
      setOk(true)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Set your display name and color preference — shown on standings and pick lists.
      </p>

      <div className="mt-6 rounded-2xl border border-neutral-200 p-6">
        {loading ? (
          <p>Loading…</p>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium">Email</label>
              <div className="mt-1 text-neutral-700">
                {profile?.email || '—'}
              </div>
            </div>

            <div>
              <label htmlFor="displayName" className="block text-sm font-medium">
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
                placeholder="e.g., Adam H."
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
              />
              <p className="mt-1 text-xs text-neutral-500">
                2–40 characters. Used in standings and league views.
              </p>
            </div>

            {/* Color Preference Section */}
            <div className="space-y-4 pt-4 border-t border-neutral-200">
              <h2 className="text-lg font-medium">Color Preference</h2>
              
              <div>
                <label htmlFor="teamSelect" className="block text-sm font-medium mb-1">
                  Select Team
                </label>
                <select
                  id="teamSelect"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                >
                  <option value="">Choose a team...</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTeamId && colorOptions.length > 0 && (
                <div>
                  <label htmlFor="colorSelect" className="block text-sm font-medium mb-1">
                    Select Color
                  </label>
                  <select
                    id="colorSelect"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                  >
                    {colorOptions.map(option => (
                      <option key={option.key} value={option.hex || '#000000'}>
                        {option.label} - {option.hex}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Color Preview */}
              <div>
                <label className="block text-sm font-medium mb-2">Preview</label>
                <div
                  className="rounded-2xl border-2 px-4 py-3 text-center font-semibold"
                  style={{
                    borderColor: selectedColor,
                    color: selectedColor,
                    backgroundColor: 'transparent',
                  }}
                >
                  {displayName || profile?.display_name || 'Your Name'}
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  This is how your name will appear in standings and league views.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving || displayName.trim().length < 2}
                className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <Link
                href="/"
                className="rounded-xl border border-neutral-300 px-4 py-2"
              >
                Back home
              </Link>
              {ok && <span className="text-green-600">Saved!</span>}
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
