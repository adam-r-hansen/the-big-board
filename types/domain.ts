// types/domain.ts
export type UUID = string;

export enum PickKind { NORMAL = 'NORMAL', BONUS = 'BONUS' }
export enum LeagueRole { OWNER = 'OWNER', ADMIN = 'ADMIN', MEMBER = 'MEMBER' }
export enum GameStatus { SCHEDULED = 'SCHEDULED', LIVE = 'LIVE', FINAL = 'FINAL', BYE = 'BYE' }

export interface Team {
  id: UUID;
  name: string | null;
  abbreviation: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  color_tertiary: string | null;
  color_quaternary: string | null;
  color_pref_light: 'primary' | 'secondary' | 'tertiary' | 'quaternary' | null;
  color_pref_dark: 'primary' | 'secondary' | 'tertiary' | 'quaternary' | null;
  logo: string | null;
  logo_dark: string | null;
}

export interface Game {
  id: UUID;
  season: number;
  week: number;
  home_team: UUID;
  away_team: UUID;
  game_utc: string | null; // ISO
  status?: GameStatus | null;
  homeScore?: number | null;
  awayScore?: number | null;
}

export interface Pick {
  id: UUID;
  league_id: UUID;
  profile_id: UUID;
  season: number;
  week: number;
  team_id: UUID;
  game_id: UUID | null;
  kind: PickKind;
  created_at?: string;
}

export interface LeagueMember {
  id?: UUID;
  league_id: UUID;
  profile_id: UUID;
  role: LeagueRole;
}
