'use client'
import { useMemo } from 'react'

export type Team = {
  id: string
  name: string
  abbreviation: string
  logo?: string | null
  logo_dark?: string | null
  color_primary?: string | null
  color_secondary?: string | null
  color_tertiary?: string | null
  color_quaternary?: string | null
  color_pref_light?: 'primary' | 'secondary' | 'tertiary' | 'quaternary' | null
  color_pref_dark?: 'primary' | 'secondary' | 'tertiary' | 'quaternary' | null
}

type PillProps = {
  team?: Team
  picked?: boolean
  disabled?: boolean
  onClick?: () => void
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

function parseHex(hex?: string | null) {
  if (!hex) return null
  const s = hex.trim().replace('#', '')
  if (![3, 6].includes(s.length)) return null
  const v = s.length === 3 ? s.split('').map(c => c + c).join('') : s
  const r = parseInt(v.slice(0, 2), 16),
    g = parseInt(v.slice(2, 4), 16),
    b = parseInt(v.slice(4, 6), 16)
  return { r, g, b }
}
function relL({ r, g, b }: { r: number; g: number; b: number }) {
  const f = (c: number) => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const R = f(r),
    G = f(g),
    B = f(b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}
function contrast(bgHex: string, textHex: string) {
  const bg = parseHex(bgHex),
    tx = parseHex(textHex)
  if (!bg || !tx) return 0
  const L1 = relL(bg) + 0.05,
    L2 = relL(tx) + 0.05
  return L1 > L2 ? L1 / L2 : L2 / L1
}
function textOn(bgHex?: string | null) {
  const bg = bgHex || '#e5e7eb'
  return contrast(bg, '#000000') >= contrast(bg, '#ffffff') ? '#000000' : '#ffffff'
}
function tint(hex?: string | null, amt = 0.9) {
  const c = parseHex(hex)
  if (!c) return '#e5e7eb'
  const r = Math.round(c.r + (255 - c.r) * amt),
    g = Math.round(c.g + (255 - c.g) * amt),
    b = Math.round(c.b + (255 - c.b) * amt)
  return `rgb(${r}, ${g}, ${b})`
}
function colorByKey(t?: Team, key?: string | null) {
  if (!t) return null
  switch (key) {
    case 'primary':
      return t.color_primary
    case 'secondary':
      return t.color_secondary
    case 'tertiary':
      return t.color_tertiary
    case 'quaternary':
      return t.color_quaternary
    default:
      return null
  }
}
function teamBaseColor(t?: Team, dark = false) {
  const pref = dark ? t?.color_pref_dark : t?.color_pref_light
  const chosen = colorByKey(t, pref || undefined)
  return chosen || t?.color_primary || t?.color_secondary || t?.color_tertiary || t?.color_quaternary || '#e5e7eb'
}

export default function TeamPill({ team, picked, disabled, onClick }: PillProps) {
  // prefer dark logo if user prefers dark
  const prefersDark =
    typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false : false

  const style = useMemo(() => {
    const base = teamBaseColor(team, prefersDark)
    return {
      bg: tint(base, 0.9),
      fg: textOn(tint(base, 0.9)),
      border: base,
      logo: prefersDark ? team?.logo_dark || team?.logo || null : team?.logo || team?.logo_dark || null,
    }
  }, [team, prefersDark])

  const label = team ? `${team.abbreviation} — ${team.name}` : '—'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={cx(
        'w-full rounded-full px-3 py-2 border transition-[border-width,transform,opacity]',
        'text-left flex items-center gap-2',
        disabled && 'opacity-50 cursor-not-allowed',
        picked ? 'border-2 ring-1 ring-black/5 dark:ring-white/10' : 'border'
      )}
      style={{ background: style.bg, color: style.fg, borderColor: style.border }}
      title={label}
    >
      {/* raw <img> avoids next/image remotePatterns config */}
      {style.logo ? (
        <img
          src={style.logo}
          width={18}
          height={18}
          alt=""
          className="rounded"
          onError={(e) => {
            // hide broken logos gracefully
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      ) : null}
      <span className="font-semibold truncate">{label}</span>
    </button>
  )
}

