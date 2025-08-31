import { z } from 'zod';
import { GameStatus, LeagueRole, PickKind } from '@/types/domain';

export const uuid = z.string().uuid();

export const pickKindSchema = z.nativeEnum(PickKind);
export const leagueRoleSchema = z.nativeEnum(LeagueRole);
export const gameStatusSchema = z.nativeEnum(GameStatus);

export const teamSchema = z.object({
  id: uuid,
  name: z.string().nullable(),
  abbreviation: z.string().nullable(),
  color_primary: z.string().nullable(),
  color_secondary: z.string().nullable(),
  color_tertiary: z.string().nullable(),
  color_quaternary: z.string().nullable(),
  color_pref_light: z.enum(['primary','secondary','tertiary','quaternary']).nullable(),
  color_pref_dark: z.enum(['primary','secondary','tertiary','quaternary']).nullable(),
  logo: z.string().url().nullable().or(z.literal('').transform(() => null)),
  logo_dark: z.string().url().nullable().or(z.literal('').transform(() => null)),
});

export const gameSchema = z.object({
  id: uuid,
  season: z.number().int(),
  week: z.number().int(),
  home_team: uuid,
  away_team: uuid,
  game_utc: z.string().datetime().nullable(),
  status: gameStatusSchema.nullable().optional(),
  homeScore: z.number().int().nullable().optional(),
  awayScore: z.number().int().nullable().optional(),
});

export const pickSchema = z.object({
  id: uuid,
  league_id: uuid,
  profile_id: uuid,
  season: z.number().int(),
  week: z.number().int(),
  team_id: uuid,
  game_id: uuid.nullable(),
  kind: z.nativeEnum(PickKind),
  created_at: z.string().datetime().optional(),
});

export const createPickInputSchema = z.object({
  leagueId: uuid,
  season: z.number().int(),
  week: z.number().int(),
  teamId: uuid,
  gameId: uuid.optional().nullable(),
});

export const deletePickInputSchema = z.object({
  id: uuid
});
