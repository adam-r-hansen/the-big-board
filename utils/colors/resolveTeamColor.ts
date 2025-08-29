export type TeamColorKeys =
  | 'color_primary'
  | 'color_secondary'
  | 'color_tertiary'
  | 'color_quaternary'

export type ThemeMode = 'light' | 'dark'

export function resolveTeamColor(team: any, theme: ThemeMode): string {
  const key: TeamColorKeys =
    theme === 'dark'
      ? (team.ui_dark_color_key ?? 'color_secondary')
      : (team.ui_light_color_key ?? 'color_primary')

  return (team?.[key] as string) || '#888888'
}

/** quick WCAG-ish text color heuristic */
export function readableTextOn(bg: string): '#000' | '#fff' {
  try {
    const hex = bg.replace('#', '')
    const v =
      hex.length === 3
        ? hex.split('').map((c) => parseInt(c + c, 16))
        : [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map((h) =>
            parseInt(h, 16)
          )
    const [r, g, b] = v
    const yiq = (r * 299 + g * 587 + b * 114) / 1000
    return yiq >= 160 ? '#000' : '#fff'
  } catch {
    return '#000'
  }
}

/** 20% tint from a solid hex (e.g. for backgrounds) */
export function tint20(hex: string): string {
  const clean = hex.replace('#', '')
  if (clean.length === 3) {
    const rr = clean[0] + clean[0]
    const gg = clean[1] + clean[1]
    const bb = clean[2] + clean[2]
    return `#${rr}${gg}${bb}33`
  }
  return `#${clean}33`
}
