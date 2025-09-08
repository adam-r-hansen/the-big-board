// lib/teamColors.ts
export type TeamRecord = {
  id: string
  abbreviation?: string | null
  short_name?: string | null
  name?: string | null

  // base palette
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

const HEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/
const isHex = (s?: string | null) => !!s && HEX.test(s)

const fromKey = (t: TeamRecord, key?: string | null): string | undefined => {
  if (!key) return undefined
  const v = (t as any)[key] as string | undefined
  return isHex(v) ? v : undefined
}

/**
 * Returns UI colors that respect Admin prefs:
 * - explicit hex overrides (color_pref_light / color_pref_dark)
 * - otherwise the selected palette key (ui_light_color_key / ui_dark_color_key)
 * - safe fallbacks
 *
 * We use:
 *   primary   => border/text color (darker)
 *   secondary => soft fill (lighter)
 */
export function resolveTeamUi(t?: TeamRecord): { primary: string; secondary: string } {
  if (!t) return { primary: '#374151', secondary: '#6b7280' } // neutral slate/gray fallback

  const darkOverride = isHex(t.color_pref_dark) ? t.color_pref_dark! : undefined
  const lightOverride = isHex(t.color_pref_light) ? t.color_pref_light! : undefined

  const darkKey = fromKey(t, t.ui_dark_color_key) || t.color_primary || t.color_secondary
  const lightKey = fromKey(t, t.ui_light_color_key) || t.color_secondary || t.color_primary

  const primary = darkOverride || (isHex(darkKey) ? (darkKey as string) : '#374151')
  const secondary = lightOverride || (isHex(lightKey) ? (lightKey as string) : '#6b7280')

  return { primary, secondary }
}
