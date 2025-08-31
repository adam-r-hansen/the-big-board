'use client'

import { toToken, pickColor } from '@/ui/theme/teams'
import type { Team } from '@/types/domain'
import { useEffect, useMemo, useState } from 'react'

type Props = {
  team?: Team | null
  disabled?: boolean
  picked?: boolean
  onClick?: () => void
}

function hexToRgb(hex?: string | null) {
  if (!hex) return null
  const s = hex.replace('#', '')
  const v = s.length === 3 ? s.split('').map(c=>c+c).join('') : s
  const r = parseInt(v.slice(0,2),16), g = parseInt(v.slice(2,4),16), b = parseInt(v.slice(4,6),16)
  return { r, g, b }
}
function textOn(bgHex?: string | null) {
  const c = hexToRgb(bgHex); if (!c) return '#111'
  const lum = (0.2126*c.r + 0.7152*c.g + 0.0722*c.b)/255
  return lum > 0.6 ? '#111' : '#fff'
}

export default function TeamPill({ team, disabled, picked, onClick }: Props) {
  const token = useMemo(() => toToken(team ?? null), [team])
  const bg = pickColor(token, 'light') // if you support dark mode, swap based on theme
  const fg = textOn(bg)

  const [src, setSrc] = useState<string | null>(token.logoUrl)
  useEffect(() => { setSrc(token.logoUrl) }, [token.logoUrl])

  const className = [
    'w-full rounded-full border px-3 py-2 text-left',
    'flex items-center gap-2',
    disabled ? 'opacity-60 cursor-not-allowed' : '',
    picked ? 'ring-2 ring-offset-0' : ''
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={className}
      style={{ backgroundColor: bg ?? undefined, color: fg }}
      aria-pressed={picked ? 'true' : 'false'}
    >
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-white/70">
        {src ? (
          <img
            src={src}
            alt={team?.abbreviation ?? team?.name ?? 'Team'}
            className="h-5 w-5 object-contain"
            onError={() => setSrc('/team-placeholder.svg')}
          />
        ) : (
          <img
            src="/team-placeholder.svg"
            alt="Team"
            className="h-5 w-5 object-contain"
          />
        )}
      </span>
      <span className="truncate">
        {team?.abbreviation ?? team?.name ?? '—'}
      </span>
    </button>
  )
}
