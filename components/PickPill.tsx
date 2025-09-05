'use client'

type TeamLike = {
  id?: string
  abbreviation?: string | undefined | null
  short_name?: string | undefined | null
  name?: string | undefined | null
  color_primary?: string | undefined | null
  color_secondary?: string | undefined | null
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

  const primary = t.color_primary ?? '#111827'
  const secondary = t.color_secondary ?? '#6B7280'

  return (
    <span
      className="inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-sm font-medium select-none"
      style={{
        // FLAT background
        background: 'transparent',
        borderColor: primary as string,
        color: primary as string,
      }}
    >
      <span className="hidden md:inline">{name}</span>
      <span className="md:hidden">{t.short_name ?? abbr || '—'}</span>

      {typeof score === 'number' && (
        <span
          className="ml-1 inline-flex min-w-6 items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold"
          style={{
            background: 'rgba(0,0,0,0.05)',
            color: primary as string,
          }}
        >
          {score}
        </span>
      )}

      {status && (
        <span
          className="ml-1 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: secondary as string }}
        >
          {status}
        </span>
      )}
    </span>
  )
}
