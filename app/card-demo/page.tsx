'use client'

import { useState } from 'react'
import TeamCard from '@/components/TeamCard'
import { getTeamCardVariant, getTeamCardDisplayText } from '@/lib/teamCardHelpers'

// Sample team data
const sampleTeams = [
  {
    id: '1',
    name: 'Seattle Seahawks',
    short_name: 'Seahawks',
    abbreviation: 'SEA',
    logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
    color_primary: '#002a5c',
    color_secondary: '#69be28',
    color_pref_light: '#002a5c',
    color_pref_dark: '#002a5c',
  },
  {
    id: '2',
    name: 'Kansas City Chiefs',
    short_name: 'Chiefs',
    abbreviation: 'KC',
    logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
    color_primary: '#E31837',
    color_secondary: '#FFB81C',
    color_pref_light: '#E31837',
    color_pref_dark: '#E31837',
  },
  {
    id: '3',
    name: 'New York Jets',
    short_name: 'Jets',
    abbreviation: 'NYJ',
    logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
    color_primary: '#125740',
    color_secondary: '#000000',
    color_pref_light: '#125740',
    color_pref_dark: '#125740',
  },
]

export default function CardDemoPage() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">TeamCard Component Demo</h1>
      
      <div className="space-y-12">
        {/* Picks Page - Available */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Picks Page - Available to Pick</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Hollow cards with hover effect (on web)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sampleTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                variant={getTeamCardVariant('picks', false, false)}
                displayText="short"
                onClick={() => alert(`Clicked ${team.name}`)}
              />
            ))}
          </div>
        </section>

        {/* Picks Page - Already Used */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Picks Page - Already Used</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Greyscale with reduced opacity (can't pick again)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sampleTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                variant={getTeamCardVariant('picks', false, true)}
                displayText="short"
                disabled
              />
            ))}
          </div>
        </section>

        {/* Picks Page - Selected */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Picks Page - Selected/Picked</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Solid fill with white text and logo background
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sampleTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                variant={getTeamCardVariant('picks', true, false)}
                displayText="short"
                onClick={() => setSelectedTeam(team.id)}
              />
            ))}
          </div>
        </section>

        {/* Other Pages - Main Body */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Other Pages - Main Body</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Always solid with full team name
          </p>
          <div className="grid grid-cols-1 gap-4">
            {sampleTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                variant={getTeamCardVariant('other')}
                displayText={getTeamCardDisplayText('main')}
              />
            ))}
          </div>
        </section>

        {/* Sidebar */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Sidebar Cards</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Compact with abbreviation only
          </p>
          <div className="grid grid-cols-1 gap-3 max-w-xs">
            {sampleTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                variant={getTeamCardVariant('other')}
                displayText={getTeamCardDisplayText('sidebar')}
                className="p-3"
              />
            ))}
          </div>
        </section>

        {/* Mobile */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Mobile Cards</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Short name for better mobile UX
          </p>
          <div className="grid grid-cols-1 gap-3 max-w-sm">
            {sampleTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                variant={getTeamCardVariant('other')}
                displayText={getTeamCardDisplayText('mobile')}
              />
            ))}
          </div>
        </section>

        {/* Interactive Demo */}
        <section className="border-t pt-8">
          <h2 className="text-2xl font-semibold mb-4">Interactive Picks Demo</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Click a team to "pick" it. Try picking the same team twice to see the greyscale state.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sampleTeams.map((team) => {
              const isPicked = selectedTeam === team.id
              const isUsed = selectedTeam !== null && selectedTeam !== team.id
              
              return (
                <TeamCard
                  key={team.id}
                  team={team}
                  variant={getTeamCardVariant('picks', isPicked, isUsed)}
                  displayText="short"
                  onClick={() => setSelectedTeam(team.id)}
                  disabled={isUsed}
                />
              )
            })}
          </div>
          {selectedTeam && (
            <button
              onClick={() => setSelectedTeam(null)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Reset Selection
            </button>
          )}
        </section>
      </div>
    </main>
  )
}
