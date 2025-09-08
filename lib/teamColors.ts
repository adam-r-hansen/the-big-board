// lib/teamColors.ts
// A tolerant adapter around the Admin "Teams — UI Colors" data.
// It accepts many shapes and always returns a consistent index the UI can use.

export type TeamRecord = {
  id: string
  abbr?: string
  nickname?: string
  city?: string
  name?: string
  // original source row for debugging
  _raw?: any
  ui: {
    light: { color: string }
    dark: { color: string }
  }
}

export type Team = TeamRecord

const HEX = /^#(?:[0-9a-f]{3}){1,2}$/i
const normHex = (v?: string) => (v && HEX.test(v) ? v.toUpperCase() : undefined)

function pick(obj: any, keys: string[], fallback?: any) {
  for (const k of keys) {
    const v = obj?.[k]
    if (v !== undefined && v !== null) return v
  }
  return fallback
}

// Try to read the admin palette { color_primary, color_secondary, ... }
function getPalette(row: any): Record<string, string> {
  const p =
    row?.palette ||
    row?.colors ||
    row?.base_palette ||
    row?.basePalette ||
    {}
  const keys = [
    'color_primary',
    'color_secondary',
    'color_tertiary',
    'color_quaternary',
  ]
  const out: Record<string, string> = {}
  for (const k of keys) {
    const hx = normHex(p[k] || row?.[k])
    if (hx) out[k] = hx
  }
  return out
}

// Admin lets you choose "color_primary" (etc) OR a direct hex override per mode
function resolveModeHex(row: any, mode: 'light' | 'dark', palette: Record<string, string>) {
  // a lot of possible shapes, try them all without throwing
  const ui = row?.ui || {}
  const m = ui?.[mode] || {}

  const key =
    m?.key ||
    m?.color_key ||
    row?.[`ui_${mode}_key`] ||
    row?.[`${mode}_key`] ||
    'color_primary'

  const override =
    m?.hex ||
    row?.[`ui_${mode}_hex`] ||
    row?.[`${mode}_hex`] ||
    null

  const byKey = palette[key as keyof typeof palette]
  const picked = normHex(override) || normHex(byKey) || '#111827' // neutral as last resort
  return picked.toUpperCase()
}

export function buildTeamIndex(map: Record<string, any> | undefined | null) {
  const out: Record<string, TeamRecord> = {}
  if (!map || typeof map !== 'object') return out

  for (const [id, row] of Object.entries<any>(map)) {
    const palette = getPalette(row)
    const light = resolveModeHex(row, 'light', palette)
    const dark = resolveModeHex(row, 'dark', palette)
    const abbr = pick(row, ['abbr', 'code', 'short', 'short_name'])
    const nickname = pick(row, ['nickname', 'nick', 'team', 'mascot'])
    const city = pick(row, ['city', 'location'])
    const name = pick(row, ['name', 'display_name', 'displayName'])

    out[id] = {
      id,
      abbr,
      nickname,
      city,
      name,
      _raw: row,
      ui: {
        light: { color: light },
        dark: { color: dark },
      },
    }
  }
  return out
}

// Convenience for callers that already have a TeamRecord
export function resolveTeamUi(t?: TeamRecord) {
  if (!t) {
    const fallback = '#111827'
    return {
      light: { color: fallback },
      dark: { color: fallback },
    }
  }
  return t.ui
}
