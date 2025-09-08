// components/ui/TeamPill.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import type { TeamRecord } from '@/lib/teamColors'
import { resolveTeamUi } from '@/lib/teamColors'

type Size = 'sm' | 'md' | 'lg' | 'xl'
type Variant = 'subtle' | 'pill' | 'chip'
type LabelMode = 'abbr' | 'name' | 'abbrNick' | 'cityNick'

type Props = {
  teamId?: string
  teamIndex: Record<string, TeamRecord>
  team?: TeamRecord
  size?: Size
  mdUpSize?: Size
  fluid?: boolean
  fixedWidth?: boolean
  variant?: Variant
  selected?: boolean
  disabled?: boolean
  labelMode?: LabelMode
  className?: string
  title?: string
  onClick?: () => void
}

function useIsDark() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => setDark(root.classList.contains('dark') || query.matches)
    sync()
    const cb = () => sync()
    query.addEventListener?.('change', cb)
    const obs = new MutationObserver(sync)
    obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => {
      query.removeEventListener?.('change', cb)
      obs.disconnect()
    }
  }, [])
  return dark
}

export default function TeamPill({
  teamId,
  teamIndex,
  team,
  size = 'md',
  mdUpSize,
  fluid,
  fixedWidth,
  variant = 'subtle',
  selected,
  disabled,
  labelMode = 'abbrNick',
  className = '',
  title,
  onClick,
}: Props) {
  const isDark = useIsDark()
  const rec = useMemo(() => team || (teamId ? teamIndex[teamId] : undefined), [team, teamId, teamIndex])

  const ui = resolveTeamUi(rec)
  const color = isDark ? ui.dark.color : ui.light.color

  // label
  const abbr = rec?.abbr?.toUpperCase()
  const nick = rec?.nickname
  const city = rec?.city
  const full = rec?.name || (city && nick ? `${city} ${nick}` : nick || abbr || '—')

  const label =
    labelMode === 'abbr'
      ? abbr || full
      : labelMode === 'name'
      ? full
      : labelMode === 'cityNick'
      ? city && nick
        ? `${city} ${nick}`
        : full
      : // abbrNick
        abbr && nick
      ? `${abbr} ${nick}`
      : full

  // sizing
  const baseH = { sm: 'h-8 text-sm', md: 'h-10 text-base', lg: 'h-12 text-lg', xl: 'h-14 text-xl' }[size]
  const mdH = mdUpSize ? { sm: 'md:h-8 md:text-sm', md: 'md:h-10 md:text-base', lg: 'md:h-12 md:text-lg', xl: 'md:h-14 md:text-xl' }[mdUpSize] : ''
  const width = fixedWidth ? 'w-[220px]' : fluid ? 'w-full' : 'w-auto'
  const cursor = disabled ? 'cursor-not-allowed opacity-60' : onClick ? 'cursor-pointer' : ''
  const sel = selected ? 'ring-1 ring-offset-0' : ''

  // variant
  const common =
    'inline-flex items-center justify-center rounded-full border px-4 font-semibold transition-colors whitespace-nowrap overflow-hidden text-ellipsis'
  const style = { borderColor: color, color } as React.CSSProperties

  const vClass =
    variant === 'pill'
      ? 'bg-white dark:bg-neutral-950'
      : variant === 'chip'
      ? 'bg-transparent'
      : // "subtle": faint fill
        'bg-gradient-to-b from-white to-neutral-50 dark:from-neutral-950 dark:to-neutral-900'

  return (
    <button
      type="button"
      className={`${common} ${baseH} ${mdH} ${width} ${cursor} ${sel} ${vClass} ${className}`}
      style={style}
      title={title || full}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
    >
      <span className="truncate">{label}</span>
    </button>
  )
}
