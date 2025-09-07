'use client'
import * as React from 'react'

type Team = {
  id: string
  abbreviation?: string | null
  short_name?: string | null
  name?: string | null
  color_primary?: string | null
  color_secondary?: string | null
} | null

type ApiRow = {
  pickId: string
  profileId: string
  name?: string | null
  team?: Team | null
  gameUtc?: string | null
  status?: string | null
  profiles?: { display_name?: string | null; email?: string | null } | null
}

function safeName(row: ApiRow) {
  if (row.name && row.name.trim()) return row.name.trim()
  const dn = row.profiles?.display_name?.trim()
  if (dn) return dn
  const em = row.profiles?.email
  if (em) return em.split('@')[0]
  return 'Unknown'
}

function teamLabel(team?: Team | null) {
  return team?.short_name ?? team?.abbreviation ?? team?.name ?? 'Team'
}

export default function LeagueLockedPicksCard(props: {
  leagueId: string
  season: number
  week: number
}) {
  const { leagueId, season, week } = props
  const [rows, setRows] = React.useState<ApiRow[] | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setErr(null)
      setRows(null)

      const urls = [
        `/api/league-picks-week?leagueId=${leagueId}&season=${season}&week=${week}`,
        `/api/league-locked-picks?leagueId=${leagueId}&season=${season}&week=${week}`,
        `/api/league-picks-week2?leagueId=${leagueId}&season=${season}&week=${week}`,
      ]

      for (const u of urls) {
        try {
          const r = await fetch(u, { credentials: 'include' })
          const j = await r.json()
          if (cancelled) return
          if (j && !j.error && Array.isArray(j.rows)) {
            setRows(j.rows as ApiRow[])
            return
          }
        } catch {
          // try next URL
        }
      }
      setErr('Unable to load league locked picks')
      setRows([])
    }
    load()
    return () => {
      cancelled = true
    }
  }, [leagueId, season, week])

  return (
    <div className="rounded-2xl border p-4">
      <h3 className="text-lg font-semibold mb-2">League picks (locked)</h3>

      {!rows && !err && <p className="text-sm text-muted-foreground">Loading…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {rows && rows.length === 0 && !err && (
        <p className="text-sm text-muted-foreground">No locked picks yet.</p>
      )}

      {rows && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.pickId}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <span className="text-sm">{safeName(r)}</span>
              <span
                className="text-sm font-medium"
                style={{
                  borderBottom: r.team?.color_primary
                    ? `2px solid ${r.team.color_primary}`
                    : undefined,
                }}
                title={r.team?.name ?? undefined}
              >
                {teamLabel(r.team ?? null)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
