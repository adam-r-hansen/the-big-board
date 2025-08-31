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
  color_pref_light?: 'primary'|'secondary'|'tertiary'|'quaternary'|null
  color_pref_dark?: 'primary'|'secondary'|'tertiary'|'quaternary'|null
}

function hexToRgb(hex?: string | null) {
  if (!hex) return null
  const s = hex.replace('#','')
  if (!(s.length === 3 || s.length === 6)) return null
  const v = s.length === 3 ? s.split('').map(c=>c+c).join('') : s
  const r = parseInt(v.slice(0,2),16), g = parseInt(v.slice(2,4),16), b = parseInt(v.slice(4,6),16)
  return { r, g, b }
}
function luminance({r,g,b}:{r:number;g:number;b:number}) {
  const f=(c:number)=>{ c/=255; return c<=0.03928? c/12.92 : Math.pow((c+0.055)/1.055,2.4)}
  const R=f(r), G=f(g), B=f(b); return 0.2126*R + 0.7152*G + 0.0722*B
}
function contrast(bg: string, tx: string) {
  const b = hexToRgb(bg), t = hexToRgb(tx); if(!b||!t) return 0
  const L1 = luminance(b) + 0.05, L2 = luminance(t) + 0.05
  return L1 > L2 ? L1/L2 : L2/L1
}
function textOn(bg?: string | null) {
  const base = bg || '#e5e7eb'
  return contrast(base, '#000000') >= contrast(base, '#ffffff') ? '#000000' : '#ffffff'
}
function tint(hex?: string | null, amt = 0.9) {
  const c = hexToRgb(hex); if (!c) return '#e5e7eb'
  const r=Math.round(c.r+(255-c.r)*amt), g=Math.round(c.g+(255-c.g)*amt), b=Math.round(c.b+(255-c.b)*amt)
  return `rgb(${r}, ${g}, ${b})`
}
function pickColor(t?: Team, dark=false) {
  const key = (dark ? t?.color_pref_dark : t?.color_pref_light) || null
  const map: any = {
    primary: t?.color_primary, secondary: t?.color_secondary,
    tertiary: t?.color_tertiary, quaternary: t?.color_quaternary
  }
  return (key ? map[key] : null) || t?.color_primary || t?.color_secondary || t?.color_tertiary || t?.color_quaternary || '#e5e7eb'
}

export type PillProps = {
  team?: Team
  picked?: boolean
  disabled?: boolean
  onClick?: () => void
  compact?: boolean
}
export default function TeamPill({ team, picked=false, disabled=false, onClick, compact=false }: PillProps) {
  const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
  const base = pickColor(team, !!prefersDark)
  const bg = tint(base, 0.90)
  const fg = textOn(bg)
  const logo = team ? (prefersDark ? (team.logo_dark || team.logo) : (team.logo || team.logo_dark)) : null

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="w-full rounded-full border transition-[border-width] inline-flex items-center gap-2"
      style={{
        minHeight: compact ? 36 : 48,
        padding: compact ? '6px 10px' : '10px 14px',
        background: disabled ? '#e5e7eb' : bg,
        color: disabled ? '#6b7280' : fg,
        borderColor: base,
        borderWidth: picked ? 2 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 700, letterSpacing: 0.2,
      }}
      title={team ? `${team.abbreviation} — ${team.name}` : '—'}
    >
      {logo && (
        <Image
          src={logo}
          alt=""
          width={compact ? 16 : 20}
          height={compact ? 16 : 20}
          className="rounded"
        />
      )}
      <span>{team ? `${team.abbreviation} — ${team.name}` : '—'}</span>
    </button>
  )
}

