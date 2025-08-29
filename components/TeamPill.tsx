'use client'
import Image from 'next/image'
import { clsx } from 'clsx'

export default function TeamPill({
  name,
  abbr,
  logo,
  tint,      // e.g. '#00336633'  (20% alpha)
  color,     // e.g. '#003366'    (solid)
  textColor, // '#000' | '#fff'
  selected,
  disabled,
  onClick,
}: {
  name: string
  abbr?: string
  logo?: string | null
  tint: string
  color: string
  textColor: string
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "relative inline-flex items-center gap-2 rounded-full",
        "px-4 h-14 min-w-[300px] justify-start text-sm font-semibold",
        "shadow-sm ring-1 ring-inset transition-all",
        "focus:outline-none focus-visible:ring-2",
        disabled ? "opacity-60 cursor-not-allowed" : "hover:translate-y-[0.5px]",
      )}
      style={{
        backgroundColor: tint,
        border: `2px solid ${selected ? color : 'transparent'}`,
        color: textColor,
        // subtle 1px inner ring for structure in both themes
        boxShadow: `inset 0 0 0 1px ${selected ? color+'55' : 'rgba(0,0,0,0.08)'}`
      }}
      aria-pressed={selected}
    >
      {logo ? <Image src={logo} alt="" width={22} height={22} className="rounded-sm" /> : <span className="w-[22px]" />}
      <span className="truncate">{abbr ? `${abbr} — ` : ""}{name}</span>
    </button>
  )
}
