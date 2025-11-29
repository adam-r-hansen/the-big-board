// components/PlayoffBanner.tsx
'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type PlayoffStatus = {
  hasActiveRound: boolean
  roundType?: 'semifinal' | 'championship' | 'consolation'
  weekNumber?: number
  userSeed?: number
  picksMade?: number
  totalScore?: number
  nextUnlock?: string
}

export default function PlayoffBanner({ leagueId }: { leagueId: string }) {
  const [status, setStatus] = useState<PlayoffStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!leagueId) return
    
    ;(async () => {
      try {
        // Check for active rounds
        const roundsRes = await fetch(`/api/playoffs/rounds?leagueId=${leagueId}`, { cache: 'no-store' }).then(r => r.json())
        const activeRound = (roundsRes.rounds || []).find((r: any) => r.status === 'active')
        
        if (!activeRound) {
          setStatus({ hasActiveRound: false })
          setLoading(false)
          return
        }
        
        // Get user's playoff data
        const [picksRes, standingsRes] = await Promise.all([
          fetch(`/api/playoffs/picks?leagueId=${leagueId}&roundId=${activeRound.id}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/playoffs/standings?roundId=${activeRound.id}`, { cache: 'no-store' }).then(r => r.json())
        ])
        
        const userPicks = picksRes.userPicks || []
        const picksMade = userPicks.filter((p: any) => p.picked_at).length
        
        // Find user's membership ID from picks
        const membershipId = userPicks[0]?.league_membership_id
        const userStanding = membershipId 
          ? (standingsRes.standings || []).find((s: any) => s.league_membership_id === membershipId)
          : null
        
        // Find next unlock
        const now = new Date()
        const futurePicks = userPicks.filter((p: any) => {
          const unlockTime = new Date(p.unlock_time)
          return unlockTime > now && !p.picked_at
        })
        futurePicks.sort((a: any, b: any) => new Date(a.unlock_time).getTime() - new Date(b.unlock_time).getTime())
        
        setStatus({
          hasActiveRound: true,
          roundType: activeRound.round_type,
          weekNumber: activeRound.week_number,
          userSeed: userStanding?.seed,
          picksMade,
          totalScore: userStanding?.total_score || 0,
          nextUnlock: futurePicks[0]?.unlock_time
        })
      } catch (e) {
        setStatus({ hasActiveRound: false })
      } finally {
        setLoading(false)
      }
    })()
  }, [leagueId])

  if (loading || !status?.hasActiveRound) return null

  const roundTitle = status.roundType === 'semifinal' 
    ? 'Semifinals' 
    : status.roundType === 'championship'
    ? 'Championship'
    : 'Consolation'

  return (
    <div className="mb-6 rounded-2xl border-2 border-yellow-600 bg-gradient-to-r from-yellow-600/10 to-yellow-400/10 p-6 shadow-lg shadow-yellow-600/10">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🏆</span>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-yellow-400 bg-clip-text text-transparent">
              PLAYOFFS - {roundTitle.toUpperCase()}
            </h2>
          </div>
          <div className="flex gap-6 text-sm mt-3">
            {status.userSeed && (
              <div>
                <span className="text-neutral-600 dark:text-neutral-400">Your Seed:</span>
                <span className="ml-2 font-semibold text-yellow-600">#{status.userSeed}</span>
              </div>
            )}
            <div>
              <span className="text-neutral-600 dark:text-neutral-400">Picks Made:</span>
              <span className="ml-2 font-semibold text-yellow-600">{status.picksMade} / 4</span>
            </div>
            <div>
              <span className="text-neutral-600 dark:text-neutral-400">Score:</span>
              <span className="ml-2 font-semibold text-yellow-600">{status.totalScore} pts</span>
            </div>
          </div>
        </div>
        <Link 
          href="/playoffs"
          className="px-6 py-3 bg-gradient-to-r from-yellow-600 to-yellow-500 text-white font-bold rounded-xl hover:from-yellow-500 hover:to-yellow-400 transition-all shadow-lg hover:shadow-xl"
        >
          Make Picks →
        </Link>
      </div>
    </div>
  )
}
