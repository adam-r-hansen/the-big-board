'use client'

// Named export so other files can `import { TeamLike } from '@/components/PickPill'`
export type TeamLike = {
  id?: string
  abbreviation?: string | null | undefined
  short_name?: string | null | undefined
  name?: string | null | undefined
  color_primary?: string | null | undefined
  color_secondary?: string | null | undefined
}

export default function PickPill({
  team,
  status,
  score,
}: {
  team: TeamLike
  status?: string
  score?: number | null
}) {
  const t = team ?? {}
  const abbr = (t.abbreviation ?? '').toUpperCase()
  const name = (t.name ?? t.short_name ?? (abbr || '—')).toString()

  const primary = t.color_primary ?? '#111827'   // neutral-900
  const secondary = t.color_secondary ?? '#6B7280' // neutral-500

  return (
    <span
      className="inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-sm font-medium select-none"
      style={{
        // FLAT background (no gradients)
        background: 'transparent',
        borderColor: String(primary),
        color: String(primary),
      }}
    >
      <span className="hidden md:inline">{name}</span>
      <span className="md:hidden">{t.short_name ?? (abbr || '—')}</span>

      {typeof score === 'number' && (
        <span
          className="ml-1 inline-flex min-w-6 items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold"
          style={{
            background: 'rgba(0,0,0,0.05)',
            color: String(primary),
          }}
        >
          {score}
        </span>
      )}

      {status && (
        <span
          className="ml-1 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: String(secondary) }}
        >
          {status}
        </span>
      )}
    </span>
  )
}
