export type UUID = string

export type PickRow = {
  id: UUID
  league_id: UUID
  profile_id: UUID
  season: number
  week: number
  team_id: string
  game_id: string | null
  created_at?: string
}

export type GameRow = {
  id: string
  game_utc: string
  week: number
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  status: string | null
}

export type TeamRow = {
  id: string
  name: string
  abbreviation: string
  logo: string | null
  logo_dark: string | null
  primary_color?: string | null
  secondary_color?: string | null
}

// Playoff types
export type PlayoffSettingsRow = {
  id: UUID
  league_id: UUID
  enabled: boolean
  regular_season_weeks: number
  created_at: string
  updated_at: string
}

export type PlayoffRoundRow = {
  id: UUID
  league_id: UUID
  week_number: number
  round_type: 'semifinal' | 'championship' | 'consolation'
  status: 'pending' | 'active' | 'complete'
  created_at: string
  updated_at: string
}

export type PlayoffPickRow = {
  id: UUID
  league_membership_id: UUID
  playoff_round_id: UUID
  game_id: UUID
  pick_position: number
  unlock_time: string
  picked_at: string | null
  last_changed_at: string | null
  is_tiebreaker: boolean
  created_at: string
  updated_at: string
}

export type PlayoffStandingsRow = {
  id: UUID
  playoff_round_id: UUID
  league_membership_id: UUID
  rank: number
  total_score: number
  seed: number
  created_at: string
}
