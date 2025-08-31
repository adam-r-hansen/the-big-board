import type { Team } from '@/types/domain'

export type TeamToken = {
  primary: string | null
  secondary: string | null
  tertiary: string | null
  quaternary: string | null
  logoUrl: string | null
  logoUrlDark: string | null
  prefLight: 'primary'|'secondary'|'tertiary'|'quaternary'|null
  prefDark: 'primary'|'secondary'|'tertiary'|'quaternary'|null
}

export function toToken(team: Partial<Team> | null | undefined): TeamToken {
  if (!team) {
    return {
      primary: null, secondary: null, tertiary: null, quaternary: null,
      logoUrl: null, logoUrlDark: null, prefLight: null, prefDark: null,
    }
  }
  return {
    primary: team.color_primary ?? null,
    secondary: team.color_secondary ?? null,
    tertiary: team.color_tertiary ?? null,
    quaternary: team.color_quaternary ?? null,
    logoUrl: (team.logo && team.logo.length > 4) ? team.logo : null,
    logoUrlDark: (team.logo_dark && team.logo_dark.length > 4) ? team.logo_dark : null,
    prefLight: team.color_pref_light ?? null,
    prefDark: team.color_pref_dark ?? null,
  }
}

export function pickColor(token: TeamToken, mode: 'light'|'dark'): string | null {
  const pref = mode === 'light' ? token.prefLight : token.prefDark
  const map: Record<string, string | null> = {
    primary: token.primary,
    secondary: token.secondary,
    tertiary: token.tertiary,
    quaternary: token.quaternary,
  }
  return (pref && map[pref]) ?? token.primary ?? token.secondary ?? token.tertiary ?? token.quaternary ?? null
}
