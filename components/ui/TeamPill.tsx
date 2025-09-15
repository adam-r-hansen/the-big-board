// components/ui/TeamPill.tsx
'use client'

import React from 'react'

export type TeamShape = {
  id: string
  abbreviation?: string | null
  name?: string | null

  // canonical palette
  color_primary?: string | null
  color_secondary?: string | null
  color_tertiary?: string | null
  color_quaternary?: string | null

  // which key to use in light/dark UI
  ui_light_color_key?: 'color_primary' | 'color_secondary' | 'color_tertiary' | 'color_quaternary' | null
  ui_dark_color_key?: 'color_primary' | 'color_secondary' | 'color_tertiary' | 'color_quaternary' | null
}

type PillMode = 'light' | 'dark'
type PillSize = 'sm' | 'md' | 'lg'
type LabelMode = 'abbr' | 'name' | 'none'

/** Utility: choose the hex color for the given mode from a team’s palette */
export function pickTeamColor(mode: PillMode, team?: TeamShape | null): string {
  if (!team) return '#e5e7eb' // neutral-200 fallback

  const key =
    mode === 'light'
      ? (team.ui_light_color_key ?? 'color_primary')
      : (team.ui_dark_color_key ?? 'color_secondary')

  const hex =
    (team as any)[key] ??
    team.color_primary ??
    '#e5e7eb'

  return normalizeHex(hex)
}

/** Utility: decide an accessible text color for a background */
export function readableOn(bg: string): string {
  const { r, g, b } = hexToRgb(normalizeHex(bg))
  // relative luminance
  const toLin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const L = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
  return L > 0.55 ? '#111827' /* near-black */ : '#ffffff'
}

/** Mono look with a subtle border derived from the fill (no gradients). */
export default function TeamPill(props: {
  team?: TeamShape | null
  mode?: PillMode
  size?: PillSize
  labelMode?: LabelMode
  className?: string
  children?: React.ReactNode
}) {
  const {
    team = null,
    mode = 'light',
    size = 'md',
    labelMode = 'abbr',
    className = '',
    children,
  } = props

  const bg = pickTeamColor(mode, team)
  const fg = readableOn(bg)
  const border = mixWithBlack(bg, 0.8) // subtle outline from same hue

  const pxPy =
    size === 'sm' ? 'px-2 py-1 text-xs' :
    size === 'lg' ? 'px-4 py-2 text-sm' :
    'px-3 py-1.5 text-sm'

  const label =
    labelMode === 'none' ? '' :
    labelMode === 'name'
      ? (team?.name || team?.abbreviation || '—')
      : (team?.abbreviation || team?.name || '—')

  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-semibold',
        'border',
        pxPy,
        className || '',
      ].join(' ')}
      style={{
        background: bg,
        color: fg,
        borderColor: border,
      }}
      title={typeof label === 'string' ? label : undefined}
    >
      {children ?? label}
    </span>
  )
}

/* =========================
   Small color helpers
   ========================= */

function normalizeHex(hex: string): string {
  if (!hex) return '#e5e7eb'
  let h = hex.trim()
  if (h[0] !== '#') h = `#${h}`
  if (h.length === 4) {
    // #rgb -> #rrggbb
    const r = h[1], g = h[2], b = h[3]
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  if (/^#([0-9a-f]{6})$/i.test(h)) return h.toLowerCase()
  return '#e5e7eb'
}

function hexToRgb(hex: string) {
  const h = normalizeHex(hex).slice(1)
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function rgbToHex(r: number, g: number, b: number) {
  const to2 = (n: number) => n.toString(16).padStart(2, '0')
  return `#${to2(r)}${to2(g)}${to2(b)}`
}

function mixWithBlack(hex: string, strength: number) {
  const { r, g, b } = hexToRgb(hex)
  const k = Math.min(Math.max(strength, 0), 1)
  return rgbToHex(
    Math.round(r * (1 - k)),
    Math.round(g * (1 - k)),
    Math.round(b * (1 - k)),
  )
}
