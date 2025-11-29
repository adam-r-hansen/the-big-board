// components/PlayoffNavLink.tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function PlayoffNavLink() {
  const [hasPlayoffs, setHasPlayoffs] = useState(false)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    ;(async () => {
      try {
        // Get user's leagues
        const leaguesRes = await fetch('/api/my-leagues', { cache: 'no-store' })
        const leaguesData = await leaguesRes.json()
        const leagues = leaguesData.leagues || []
        
        if (leagues.length === 0) {
          setHasPlayoffs(false)
          setLoading(false)
          return
        }

        // Check each league for active playoff rounds
        const checks = await Promise.all(
          leagues.map(async (league: any) => {
            try {
              const roundsRes = await fetch(`/api/playoffs/rounds?leagueId=${league.id}`, { cache: 'no-store' })
              const roundsData = await roundsRes.json()
              const rounds = roundsData.rounds || []
              return rounds.some((r: any) => r.status === 'active')
            } catch {
              return false
            }
          })
        )

        setHasPlayoffs(checks.some(has => has))
      } catch {
        setHasPlayoffs(false)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading || !hasPlayoffs) return null

  const isActive = pathname === '/playoffs'

  return (
    <Link 
      href="/playoffs" 
      className={`${isActive ? 'font-semibold opacity-100' : 'opacity-80 hover:opacity-100'} text-yellow-600 flex items-center gap-1`}
    >
      <span>🏆</span>
      Playoffs
    </Link>
  )
}
