'use client'
import { useState, useMemo } from 'react'

type Member = {
  profile_id: string
  display_name: string
  total_picks: number
  decided_picks: number
  correct_picks: number
  accuracy: number
  points_total: number
  avg_per_pick: number
  longest_streak: number
  current_streak: number
  wrinkle_points: number
  last_5: string[]
}

type SortKey = keyof Omit<Member, 'profile_id' | 'display_name' | 'last_5'>
type SortDirection = 'asc' | 'desc'

export default function LeagueMemberStatsTable({ members }: { members: Member[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('points_total')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')

  const sortedMembers = useMemo(() => {
    const sorted = [...members].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'desc' ? bVal - aVal : aVal - bVal
      }
      return 0
    })
    return sorted
  }, [members, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function renderSortIcon(key: SortKey) {
    if (sortKey !== key) return <span className="text-neutral-400">↕</span>
    return sortDir === 'desc' ? <span>↓</span> : <span>↑</span>
  }

  function renderLast5(games: string[]) {
    if (games.length === 0) return <span className="text-neutral-400">—</span>
    
    return (
      <div className="flex gap-1">
        {games.map((result, i) => (
          <span
            key={i}
            className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-semibold ${
              result === 'W'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            {result}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-neutral-600 border-b-2">
          <tr>
            <th className="py-3 pr-4 font-semibold">Member</th>
            <th 
              className="py-3 pr-4 font-semibold cursor-pointer hover:text-black"
              onClick={() => handleSort('total_picks')}
            >
              Picks {renderSortIcon('total_picks')}
            </th>
            <th 
              className="py-3 pr-4 font-semibold cursor-pointer hover:text-black"
              onClick={() => handleSort('correct_picks')}
            >
              Correct {renderSortIcon('correct_picks')}
            </th>
            <th 
              className="py-3 pr-4 font-semibold cursor-pointer hover:text-black"
              onClick={() => handleSort('accuracy')}
            >
              Accuracy {renderSortIcon('accuracy')}
            </th>
            <th 
              className="py-3 pr-4 font-semibold cursor-pointer hover:text-black"
              onClick={() => handleSort('points_total')}
            >
              Total Pts {renderSortIcon('points_total')}
            </th>
            <th 
              className="py-3 pr-4 font-semibold cursor-pointer hover:text-black"
              onClick={() => handleSort('avg_per_pick')}
            >
              Avg/Pick {renderSortIcon('avg_per_pick')}
            </th>
            <th 
              className="py-3 pr-4 font-semibold cursor-pointer hover:text-black"
              onClick={() => handleSort('longest_streak')}
            >
              Streak {renderSortIcon('longest_streak')}
            </th>
            <th 
              className="py-3 pr-4 font-semibold cursor-pointer hover:text-black"
              onClick={() => handleSort('wrinkle_points')}
            >
              Wrinkle {renderSortIcon('wrinkle_points')}
            </th>
            <th className="py-3 font-semibold">Last 5</th>
          </tr>
        </thead>
        <tbody>
          {sortedMembers.map((member, idx) => (
            <tr key={member.profile_id} className="border-b border-neutral-200 hover:bg-neutral-50">
              <td className="py-3 pr-4 font-medium">{member.display_name}</td>
              <td className="py-3 pr-4">{member.total_picks}</td>
              <td className="py-3 pr-4">{member.correct_picks}</td>
              <td className="py-3 pr-4">{(member.accuracy * 100).toFixed(1)}%</td>
              <td className="py-3 pr-4 font-semibold">{member.points_total}</td>
              <td className="py-3 pr-4">{member.avg_per_pick}</td>
              <td className="py-3 pr-4">
                {member.longest_streak}
                {member.current_streak >= 3 && (
                  <span className="ml-1" title={`Current streak: ${member.current_streak}`}>🔥</span>
                )}
              </td>
              <td className="py-3 pr-4">{member.wrinkle_points}</td>
              <td className="py-3">{renderLast5(member.last_5)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {sortedMembers.length === 0 && (
        <div className="text-center py-8 text-neutral-500">
          No member stats available yet.
        </div>
      )}
    </div>
  )
}
