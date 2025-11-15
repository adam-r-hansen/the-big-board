'use client'

import { useEffect, useState } from 'react'

type Team = {
  id: string
  name: string
  short_name: string
  abbreviation: string
  logo: string
  color_primary: string
  color_secondary: string
  color_tertiary: string | null
  color_quaternary: string | null
  color_pref_light: string | null
  color_pref_dark: string | null
  ui_light_color_key: string
  ui_dark_color_key: string
}

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [lightColor, setLightColor] = useState('')
  const [darkColor, setDarkColor] = useState('')

  useEffect(() => {
    loadTeams()
  }, [])

  async function loadTeams() {
    try {
      const res = await fetch('/api/admin/teams')
      const data = await res.json()
      if (res.ok) {
        setTeams(data.teams || [])
      } else {
        setMessage(data.error || 'Failed to load teams')
      }
    } catch (err: any) {
      setMessage(err?.message || 'Error loading teams')
    } finally {
      setLoading(false)
    }
  }

  function selectTeam(team: Team) {
    setSelectedTeam(team)
    setLightColor(team.color_pref_light || team.color_primary)
    setDarkColor(team.color_pref_dark || team.color_primary)
    setMessage('')
  }

  async function saveColors() {
    if (!selectedTeam) return

    setSaving(selectedTeam.id)
    setMessage('')

    try {
      const res = await fetch('/api/admin/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeam.id,
          color_pref_light: lightColor,
          color_pref_dark: darkColor,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage(`✅ Saved colors for ${selectedTeam.name}`)
        await loadTeams()
        // Update selected team with new colors
        const updatedTeam = teams.find(t => t.id === selectedTeam.id)
        if (updatedTeam) {
          selectTeam({ ...updatedTeam, color_pref_light: lightColor, color_pref_dark: darkColor })
        }
      } else {
        setMessage(`❌ ${data.error || 'Failed to save'}`)
      }
    } catch (err: any) {
      setMessage(`❌ ${err?.message || 'Error saving'}`)
    } finally {
      setSaving(null)
    }
  }

  function resetColors() {
    if (!selectedTeam) return
    setLightColor(selectedTeam.color_primary)
    setDarkColor(selectedTeam.color_primary)
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Team Color Management</h1>
        <div className="text-neutral-600 dark:text-neutral-400">Loading teams...</div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Team Color Management</h1>
        <a href="/admin" className="text-sm underline hover:no-underline">
          ← Back to Admin
        </a>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.startsWith('✅') 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
        }`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team List */}
        <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <h2 className="text-xl font-semibold mb-4">Select a Team</h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => selectTeam(team)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedTeam?.id === team.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={team.logo}
                    alt={team.name}
                    className="w-10 h-10 object-contain"
                  />
                  <div>
                    <div className="font-semibold">{team.name}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      {team.abbreviation}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Color Editor */}
        <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          {selectedTeam ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">{selectedTeam.name}</h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Customize the colors used for light and dark mode
                </p>
              </div>

              {/* Available Colors Reference */}
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <h3 className="text-sm font-semibold mb-3">Available Team Colors:</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                      Primary
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded border border-neutral-300"
                        style={{ backgroundColor: selectedTeam.color_primary }}
                      />
                      <code className="text-xs">{selectedTeam.color_primary}</code>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                      Secondary
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded border border-neutral-300"
                        style={{ backgroundColor: selectedTeam.color_secondary }}
                      />
                      <code className="text-xs">{selectedTeam.color_secondary}</code>
                    </div>
                  </div>
                  {selectedTeam.color_tertiary && (
                    <div>
                      <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                        Tertiary
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded border border-neutral-300"
                          style={{ backgroundColor: selectedTeam.color_tertiary }}
                        />
                        <code className="text-xs">{selectedTeam.color_tertiary}</code>
                      </div>
                    </div>
                  )}
                  {selectedTeam.color_quaternary && (
                    <div>
                      <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                        Quaternary
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded border border-neutral-300"
                          style={{ backgroundColor: selectedTeam.color_quaternary }}
                        />
                        <code className="text-xs">{selectedTeam.color_quaternary}</code>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Color Pickers */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Light Mode Color
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={lightColor}
                      onChange={(e) => setLightColor(e.target.value)}
                      className="w-16 h-10 rounded border border-neutral-300 dark:border-neutral-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={lightColor}
                      onChange={(e) => setLightColor(e.target.value)}
                      className="flex-1 h-10 px-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
                      placeholder="#002a5c"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Dark Mode Color
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={darkColor}
                      onChange={(e) => setDarkColor(e.target.value)}
                      className="w-16 h-10 rounded border border-neutral-300 dark:border-neutral-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={darkColor}
                      onChange={(e) => setDarkColor(e.target.value)}
                      className="flex-1 h-10 px-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
                      placeholder="#69be28"
                    />
                  </div>
                </div>
              </div>

              {/* Preview Cards */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Preview</h3>
                <div className="space-y-4">
                  {/* Light Mode Preview */}
                  <div className="p-4 bg-gray-100 rounded-lg">
                    <div className="text-xs text-gray-600 mb-2 font-semibold">
                      Light Mode
                    </div>
                    <div
                      className="p-4 rounded-lg"
                      style={{ backgroundColor: lightColor }}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={selectedTeam.logo}
                          alt={selectedTeam.name}
                          className="w-12 h-12"
                        />
                        <span className="font-semibold text-lg text-white">
                          {selectedTeam.short_name}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dark Mode Preview */}
                  <div className="p-4 bg-gray-800 rounded-lg">
                    <div className="text-xs text-gray-300 mb-2 font-semibold">
                      Dark Mode
                    </div>
                    <div
                      className="p-4 rounded-lg"
                      style={{ backgroundColor: darkColor }}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={selectedTeam.logo}
                          alt={selectedTeam.name}
                          className="w-12 h-12"
                        />
                        <span className="font-semibold text-lg text-white">
                          {selectedTeam.short_name}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={saveColors}
                  disabled={saving !== null}
                  className="flex-1 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving === selectedTeam.id ? 'Saving...' : 'Save Colors'}
                </button>
                <button
                  onClick={resetColors}
                  className="h-10 px-4 rounded-lg border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800 font-semibold transition-colors"
                >
                  Reset to Primary
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-neutral-500 dark:text-neutral-400">
              Select a team to edit colors
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
