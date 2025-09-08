// lib/teamColors.ts

export type TeamRecord = {
  id: string
  abbreviation?: string | null
  short_name?: string | null
  name?: string | null

  // base palette from teams table
  color_primary?: string | null
  color_secondary?: string | null
  color_tertiary?: string | null
  color_quaternary?: string | null

  // Admin UI prefs
  ui_light_color_key?: 'color_primary' | 'color_secondary' | 'color_tertiary' | 'color_quaternary' | null
  ui_dark_color_key?: 'color_primary' | 'color_secondary' | 'color_tertiary' | 'color_quaternary' | null
  color_pref_light?: string | null
  color_pref_dark?: string | null
}

// Back-compat type names some files already import:
export type Team = TeamRecord
export type TeamLike = TeamRecord

const HEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/
const isHex = (s?: string | null) => !!s && HEX.test(s)

const fromKey = (t: TeamRecord, key?: string | null): string | undefined => {
  if (!key) return undefined
  const v = (t as any)[key] as string | undefined
  return isHex(v) ? v : undefined
}

/**
 * Resolve UI colors honoring Admin prefs.
 * primary   -> border/text (typically darker)
 * secondary -> soft fill (typically lighter)
 */
export function resolveTeamUi(t?: TeamRecord): { primary: string; secondary: string } {
  if (!t) return { primary: '#374151', secondary: '#6b7280' } // slate/gray fallback

  const darkOverride = isHex(t.color_pref_dark) ? t.color_pref_dark! : undefined
  const lightOverride = isHex(t.color_pref_light) ? t.color_pref_light! : undefined

  const darkKey =
    fromKey(t, t.ui_dark_color_key) ||
    (isHex(t.color_primary) ? t.color_primary! : undefined) ||
    (isHex(t.color_secondary) ? t.color_secondary! : undefined)

  const lightKey =
    fromKey(t, t.ui_light_color_key) ||
    (isHex(t.color_secondary) ? t.color_secondary! : undefined) ||
    (isHex(t.color_primary) ? t.color_primary! : undefined)

  const primary = darkOverride || darkKey || '#374151'
  const secondary = lightOverride || lightKey || '#6b7280'

  return { primary, secondary }
}

/**
 * Back-compat shim for older imports.
 * Anything that previously called `resolveTeamHex(team, 'secondary')`
 * will still get the lighter UI color; default is the primary.
 */
export function resolveTeamHex(
  t?: TeamRecord,
  which: 'primary' | 'secondary' | 'ui-dark' | 'ui-light' = 'primary'
): string {
  const { primary, secondary } = resolveTeamUi(t)
  if (which === 'secondary' || which === 'ui-light') return secondary
  return primary
}

/**
 * Back-compat utility: build a lookup by id and abbreviation.
 * Used by pages that import { buildTeamIndex } from this module.
 */
export function buildTeamIndex(teamMap: Record<string, TeamRecord>): Record<string, TeamRecord> {
  const idx: Record<string, TeamRecord> = {}
  for (const t of Object.values(teamMap || {})) {
    if (!t?.id) continue
    idx[t.id] = t
    const ab = t.abbreviation?.toUpperCase()
    if (ab) idx[ab] = t
  }
  return idx
}
