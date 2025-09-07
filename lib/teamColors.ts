export type Team = {
  id: string
  abbreviation?: string | null
  short_name?: string | null
  name?: string | null
  color_primary?: string | null
  color_secondary?: string | null
  color_tertiary?: string | null
  color_quaternary?: string | null
  ui_light_color_key?: string | null
  ui_dark_color_key?: string | null
  color_pref_light?: string | null
  color_pref_dark?: string | null
}

export type TeamLike = Team

export function isHex(s?: string | null) {
  return !!(s && /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(s.trim()))
}
export function sanitizeHex(hex?: string | null): string | null {
  return isHex(hex) ? hex!.trim() : null
}
export function getByKey(t: TeamLike, key?: string | null): string | null {
  if (!key) return null
  const v = (t as any)[key]
  return typeof v === 'string' ? v : null
}

export function resolveTeamHex(team: TeamLike | undefined, theme: 'light'|'dark'): string {
  const t = team || ({} as TeamLike)
  if (theme === 'light') {
    return (
      sanitizeHex(t.color_pref_light) ||
      sanitizeHex(getByKey(t, t.ui_light_color_key)) ||
      sanitizeHex(t.color_primary) ||
      '#6b7280'
    )
  }
  return (
    sanitizeHex(t.color_pref_dark) ||
    sanitizeHex(getByKey(t, t.ui_dark_color_key)) ||
    sanitizeHex(t.color_secondary) ||
    '#6b7280'
  )
}

export function buildTeamIndex(teamMap: Record<string, TeamLike>): Record<string, TeamLike> {
  const idx: Record<string, TeamLike> = {}
  for (const t of Object.values(teamMap || {})) {
    if (!t) continue
    if (t.id) idx[t.id] = t
    if (t.abbreviation) idx[t.abbreviation.toUpperCase()] = t
  }
  return idx
}
