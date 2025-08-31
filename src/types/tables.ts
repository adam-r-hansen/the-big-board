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
