// lib/wrinkles.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type WrinkleKind =
  | 'bonus_game'
  | 'bonus_game_ats'
  | 'bonus_game_oof'
  | 'winless_double'

export async function getActiveWrinkles(
  sb: SupabaseClient,
  leagueId: string,
  season: number,
  week: number
) {
  const { data, error } = await sb
    .from('wrinkles')
    .select('id, league_id, season, week, status, kind, config')
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('week', week)
    .eq('status', 'active')
  if (error) return []
  return (data ?? []).map(w => ({
    ...w,
    kind: (w.kind ?? 'bonus_game').toLowerCase() as WrinkleKind,
  }))
}

export async function getWrinkleGames(
  sb: SupabaseClient,
  wrinkleId: string
) {
  const { data, error } = await sb
    .from('wrinkle_games')
    .select('id, wrinkle_id, season, week, game_id, spread')
    .eq('wrinkle_id', wrinkleId)
  if (error) return []
  return data ?? []
}

/** Compute team wins/losses BEFORE a given cutoff ISO time */
export async function getTeamRecordUpTo(
  sb: SupabaseClient,
  season: number,
  cutoffIso: string,
  teamId: string
) {
  const { data, error } = await sb
    .from('games')
    .select('home_team, away_team, home_score, away_score, status, game_utc')
    .eq('season', season)
    .eq('status', 'FINAL')
    .lt('game_utc', cutoffIso)
    .or(`home_team.eq.${teamId},away_team.eq.${teamId}`)
  if (error) return { wins: 0, losses: 0 }

  let wins = 0,
    losses = 0
  for (const g of data ?? []) {
    const isHome = g.home_team === teamId
    const hs = Number(g.home_score ?? 0)
    const as = Number(g.away_score ?? 0)
    if (hs === as) continue
    const won = isHome ? hs > as : as > hs
    won ? wins++ : losses++
  }
  return { wins, losses }
}
