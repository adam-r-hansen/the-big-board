'use client'
import clsx from 'clsx'

export type Team = {
  id: string
  name?: string | null
  abbreviation?: string | null
  color_primary?: string | null
  color_secondary?: string | null
  color_tertiary?: string | null
  color_quaternary?: string | null
  color_pref_light?: 'primary'|'secondary'|'tertiary'|'quaternary'|null
  color_pref_dark?: 'primary'|'secondary'|'tertiary'|'quaternary'|null
  logo?: string | null
  logo_dark?: string | null
}

function hexToRgb(hex?: string | null) {
  if (!hex) return null
  const s = hex.replace('#', '')
  const v = s.length === 3 ? s.split('').map(c=>c+c).join('') : s
  const r = parseInt(v.slice(0,2),16), g = parseInt(v.slice(2,4),16), b = parseInt(v.slice(4,6),16)
  return { r, g, b }
}
function tint(hex?: string | null, amt = 0.9) {
  const c = hexToRgb(hex); if (!c) return '#e5e7eb'
  const r = Math.round(c.r + (255 - c.r) * amt)
  const g = Math.round(c.g + (255 - c.g) * amt)
  const b = Math.round(c.b + (255 - c.b) * amt)
  return `rgb(${r}, ${g}, ${b})`
}
function textOn(bg: string) {
  // simple contrast pick
  const black = { r:0,g:0,b:0 }, white = { r:255,g:255,b:255 }
  const toL = ({r,g,b}:{r:number,g:number,b:number})=>{
    const f=(x:number)=>{x/=255;return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)}
    const c = hexToRgb(bg) || {r:200,g:200,b:200}
    const R=f(c.r),G=f(c.g),B=f(c.b);return 0.2126*R+0.7152*G+0.0722*B
  }
  const Lbg = toL(hexToRgb(bg) as any)
  const Lb = (0.2126*0+0.7152*0+0.0722*0)+0.05
  const Lw = (0.2126*1+0.7152*1+0.0722*1)+0.05
  const blackRatio = (Math.max(Lbg+0.05, Lb)) / (Math.min(Lbg+0.05, Lb))
  const whiteRatio = (Math.max(Lbg+0.05, Lw)) / (Math.min(Lbg+0.05, Lw))
  return whiteRatio >= blackRatio ? '#fff' : '#000'
}

export default function TeamPill({
  team,
  picked,
  disabled,
  onClick,
}: {
  team?: Team
  picked?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  const base =
    (team?.color_pref_light === 'primary' && team?.color_primary) ||
    (team?.color_pref_light === 'secondary' && team?.color_secondary) ||
    (team?.color_pref_light === 'tertiary' && team?.color_tertiary) ||
    (team?.color_pref_light === 'quaternary' && team?.color_quaternary) ||
    team?.color_primary || team?.color_secondary || team?.color_tertiary || team?.color_quaternary || '#e5e7eb'

  const bg = tint(base, 0.9)
  const fg = textOn(bg)
  const logo = team?.logo || team?.logo_dark

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={clsx(
        'w-full rounded-full border px-3 py-2 text-left',
        'flex items-center gap-2',
        disabled && 'opacity-60 cursor-not-allowed',
        picked && 'ring-2 ring-offset-0'
      )}
      style={{ background: bg, color: fg, borderColor: base || '#e5e7eb' }}
      title={team?.name || ''}
    >
      {logo ? <img src={logo} alt="" width={18} height={18} className="rounded" /> : null}
      <span className="font-semibold truncate">
        {team?.abbreviation ? `${team.abbreviation} — ` : ''}{team?.name || '—'}
      </span>
    </button>
  )
}

