// --- Home page chip: flat (no gradient) ---
type TeamLike = {
  id?: string
  abbreviation?: string | undefined | null
  short_name?: string | undefined | null
  name?: string | undefined | null
  color_primary?: string | undefined | null
  color_secondary?: string | undefined | null
}

function Chip({
  team,
  score,
  subtle = false,
  status,
}: {
  team: TeamLike
  score?: number | null
  subtle?: boolean
  status?: string
}) {
  const abbr = (team.abbreviation ?? '').toUpperCase()
  // name priority: full -> short -> abbr -> em dash
  const name = (team.name ?? team.short_name ?? (abbr || '—')).toString()

  // flat colors (no gradients)
  const primary = team.color_primary ?? '#111827' // neutral-900 fallback
  const secondary = team.color_secondary ?? '#6B7280' // neutral-500 fallback

  // flat look: solid bg + crisp border
  const classes =
    'inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-sm font-medium select-none'

  return (
    <span
      className={classes}
      style={{
        // FLAT: no gradient
        background: 'transparent',
        borderColor: primary as string,
        color: primary as string,
      }}
      aria-label={`${name}${typeof score === 'number' ? ` score ${score}` : ''}`}
    >
      <span className="hidden md:inline">{name}</span>
      <span className="md:hidden">{team.short_name ?? abbr || '—'}</span>

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
