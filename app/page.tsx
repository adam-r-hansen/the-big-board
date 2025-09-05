// app/page.tsx
/* Home (Big Board) — flat pill UI, no gradients */
import Link from "next/link"

export const dynamic = "force-dynamic"
export const revalidate = 0

type TeamLike = {
  id?: string
  abbreviation?: string | null
  short_name?: string | null
  name?: string | null
  color_primary?: string | null
  color_secondary?: string | null
}

type TeamMap = Record<string, TeamLike>

type GameRow = {
  id: string
  season: number
  week: number
  game_utc: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  status: "UPCOMING" | "LIVE" | "FINAL" | string
}

function formatKick(t: string) {
  const d = new Date(t)
  // Example: 9/4/2025, 5:20:00 PM
  return d.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function StatusTag({ status }: { status?: string }) {
  if (!status) return null
  return (
    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
      {status}
    </span>
  )
}

/** Flat, no-gradient team chip used on Home & Scoreboard */
function Chip({
  team,
  score,
  labelMode = "auto",
}: {
  team: TeamLike
  score?: number | null
  /** "auto" shows full on md+, short on mobile */
  labelMode?: "auto" | "short" | "full"
}) {
  const abbr = (team.abbreviation ?? "").toUpperCase()
  const short = team.short_name ?? abbr || "—"
  const full = team.name ?? short

  const label =
    labelMode === "short"
      ? short
      : labelMode === "full"
      ? full
      : undefined

  const primary = team.color_primary ?? "#111827" // neutral-900
  const border = primary
  const text = primary

  return (
    <span
      className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-base font-semibold"
      style={{
        background: "transparent", // FLAT
        borderColor: String(border),
        color: String(text),
      }}
    >
      {/* auto label behavior: short on mobile, full on md+ */}
      {label ? (
        <span>{label}</span>
      ) : (
        <>
          <span className="md:hidden">{short}</span>
          <span className="hidden md:inline">{full}</span>
        </>
      )}

      {typeof score === "number" && (
        <span
          className="ml-1 inline-flex min-w-6 items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold"
          style={{ background: "rgba(0,0,0,0.05)", color: String(text) }}
        >
          {score}
        </span>
      )}
    </span>
  )
}

async function getTeamMap(): Promise<TeamMap> {
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/team-map`, {
      cache: "no-store",
    })
    const json = await r.json()
    // API earlier returned a simple map
    return (json?.map ?? json ?? {}) as TeamMap
  } catch {
    return {}
  }
}

async function getGames(season: number, week: number): Promise<GameRow[]> {
  try {
    const r = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/games-for-week?season=${season}&week=${week}`,
      { cache: "no-store" }
    )
    const json = await r.json()
    return (json?.rows ?? json ?? []) as GameRow[]
  } catch {
    return []
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams?: { season?: string; week?: string }
}) {
  const season = Number(searchParams?.season ?? 2025)
  const week = Number(searchParams?.week ?? 1)

  const [teams, games] = await Promise.all([getTeamMap(), getGames(season, week)])

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">NFL Pick’em</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/picks"
            className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Make picks →
          </Link>
          <Link
            href={`/scoreboard?season=${season}&week=${week}`}
            className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Scoreboard →
          </Link>
        </div>
      </div>

      {/* League Overview (simple counters placeholder to avoid breaking) */}
      <section className="mb-8 rounded-2xl border p-4">
        <div className="mb-2 text-lg font-semibold">League Overview</div>
        <div className="text-sm text-gray-500">
          Use Admin to import teams & schedule. This overview can be expanded later.
        </div>
      </section>

      {/* Week games */}
      <section className="rounded-2xl border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-xl font-semibold">
            Week {week} — Games
          </h2>
          <div className="text-sm text-gray-500">Season {season}</div>
        </div>

        <div className="divide-y">
          {games.map((g) => {
            const home = teams[g.home_team] ?? { abbreviation: "—" }
            const away = teams[g.away_team] ?? { abbreviation: "—" }
            return (
              <div key={g.id} className="flex flex-col gap-2 px-4 py-4 md:gap-3">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div>
                    {formatKick(g.game_utc)} • Week {g.week}
                  </div>
                  <StatusTag status={g.status} />
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <Chip
                    team={home}
                    score={g.home_score ?? null}
                    labelMode="auto"
                  />
                  <span className="text-gray-400">—</span>
                  <Chip
                    team={away}
                    score={g.away_score ?? null}
                    labelMode="auto"
                  />
                </div>

                <div className="text-sm text-gray-500">
                  Score: {(g.home_score ?? 0)} — {(g.away_score ?? 0)}
                </div>
              </div>
            )
          })}

          {games.length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-500">No games found.</div>
          )}
        </div>
      </section>
    </main>
  )
}
