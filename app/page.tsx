'use client'

// app/page.tsx — Home (uses same sources/normalizers as Scoreboard)

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import GameCard, { type GameCardGame } from "@/components/ui/GameCard";
import AdminNavLink from "@/components/AdminNavLink";
import type { TeamShape } from "@/components/ui/TeamPill";
import { createClient as createSupabaseClient } from "@/utils/supabase/client";

/** small util */
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** NFL Tue→Mon week helper */
function tuesdayToMondayWeekIndex(d: Date) {
  const year = d.getFullYear();
  const sept1 = new Date(year, 8, 1);
  const day = sept1.getDay(); // 0..6
  const offsetToTue = (9 - day) % 7; // Tue=2
  const firstTue = new Date(year, 8, 1 + offsetToTue);
  const diffDays = Math.floor((d.getTime() - firstTue.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

/** types */
type League = { id: string; name: string; season: number };
type TeamMap = Record<string, TeamShape>;
type Pick = {
  id: string;
  team_id: string;
  game_id?: string | null;
  status?: "UPCOMING" | "LIVE" | "FINAL" | string;
  points?: number | null;
};

/** UI card */
function Card(props: { title: string; right?: ReactNode; className?: string; children: ReactNode }) {
  const { title, right, className, children } = props;
  return (
    <section
      className={cn(
        "rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5",
        className,
      )}
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </header>
      <div>{children}</div>
    </section>
  );
}

/** helpers for right-rail displays */
function gameLocked(g?: GameCardGame | null) {
  if (!g) return false;
  const s = (g.status || "").toUpperCase();
  return s === "LIVE" || s === "FINAL";
}
function pickPointsForGame(pickTeamId: string, g?: GameCardGame): number | null {
  if (!g) return null;
  const s = (g.status || "").toUpperCase();
  const hs = typeof g.home.score === "number" ? g.home.score : null;
  const as = typeof g.away.score === "number" ? g.away.score : null;
  if (s !== "FINAL") return null;
  if (hs == null || as == null) return 0;
  if (hs === as) {
    if (g.home.id === pickTeamId) return hs / 2;
    if (g.away.id === pickTeamId) return as / 2;
    return 0;
  }
  if (hs > as) return g.home.id === pickTeamId ? hs : 0;
  return g.away.id === pickTeamId ? as : 0;
}

/** NORMALIZER — copied to match Scoreboard exactly */
function normalizeGamesForCard(rows: any[]): GameCardGame[] {
  return (rows || []).map((x) => ({
    id: x.id,
    week: x.week,
    game_utc: x.game_utc || x.start_time,
    status: x.status ?? "UPCOMING",
    home: {
      id: x.home?.id ?? x.home_team ?? x.home_team_id,
      name: x.home?.name ?? x.home_name ?? null,
      abbr: x.home?.abbreviation ?? x.home_abbr ?? null,
      score: x.home_score ?? x.home?.score ?? null,
      logo: x.home?.logo ?? x.logo_home ?? null,
    },
    away: {
      id: x.away?.id ?? x.away_team ?? x.away_team_id,
      name: x.away?.name ?? x.away_name ?? null,
      abbr: x.away?.abbreviation ?? x.away_abbr ?? null,
      score: x.away_score ?? x.away?.score ?? null,
      logo: x.away?.logo ?? x.logo_away ?? null,
    },
  }));
}

function HomeInner() {
  const [season, setSeason] = useState<number>(new Date().getFullYear());
  const [week, setWeek] = useState<number>(tuesdayToMondayWeekIndex(new Date()));
  const [userPickedWeek, setUserPickedWeek] = useState(false);

  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueId, setLeagueId] = useState<string>("");

  const [teamMap, setTeamMap] = useState<TeamMap>({});
  const [games, setGames] = useState<GameCardGame[]>([]);
  const [myPicks, setMyPicks] = useState<Pick[]>([]);
  const [standRows, setStandRows] = useState<any[]>([]);
  const [authReady, setAuthReady] = useState(false);

  const picksUsed = myPicks.length;
  const picksAllowed = 2; // wrinkles removed from Home
  const picksLocked = myPicks.filter((p) => p.status === "FINAL" || p.status === "LIVE").length;
  const weekPoints = myPicks.reduce((acc, p) => acc + (typeof p.points === "number" ? p.points : 0), 0);

  // Auth callback cleanup + ready
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    (async () => {
      try {
        if (code) {
          const supabase = createSupabaseClient();
          await supabase.auth.exchangeCodeForSession(code);
          const AUTH_PARAMS = [
            "code",
            "type",
            "scope",
            "auth_callback",
            "next",
            "redirect_to",
            "provider",
            "refresh_token",
            "access_token",
          ];
          const clean = new URL(window.location.href);
          AUTH_PARAMS.forEach((p) => clean.searchParams.delete(p));
          window.history.replaceState({}, "", clean.toString());
        }
      } catch (e) {
        console.error("Auth handling failed", e);
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  // 1) Team map — EXACTLY like Scoreboard
  useEffect(() => {
    if (!authReady) return;
    (async () => {
      try {
        const tm = await fetch("/api/team-map", { cache: "no-store" }).then((r) => r.json());
        setTeamMap((tm?.teams || {}) as TeamMap);
      } catch (e) {
        console.warn("team-map failed", e);
        setTeamMap({});
      }
    })();
  }, [authReady]);

  // 2) Leagues — auto-select the first immediately (no blank state)
  useEffect(() => {
    if (!authReady) return;
    (async () => {
      try {
        const res = await fetch("/api/leagues", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const L: League[] = Array.isArray(data?.leagues) ? data.leagues : data?.rows || data || [];
          setLeagues(L);
          if (L.length > 0) {
            setLeagueId((prev) => prev || L[0].id);
            setSeason(L[0].season || new Date().getFullYear());
          }
        }
      } catch (e) {
        console.error("Load leagues failed", e);
      }
    })();
  }, [authReady]);

  // 3) Games — use the Scoreboard normalizer
  useEffect(() => {
    if (!authReady) return;
    (async () => {
      try {
        const j = await fetch(`/api/games-for-week?season=${season}&week=${week}`, { cache: "no-store" }).then((r) =>
          r.json(),
        );
        const rows = (j?.games || j || []) as any[];
        setGames(normalizeGamesForCard(rows));
      } catch (e) {
        console.error("Load games failed", e);
        setGames([]);
      }
    })();
  }, [authReady, season, week]);

  // 4) My Picks — only when a league is selected (include leagueId)
  useEffect(() => {
    if (!authReady || !leagueId) {
      setMyPicks([]);
      return;
    }
    (async () => {
      try {
        const j = await fetch(
          `/api/my-picks?leagueId=${encodeURIComponent(leagueId)}&season=${season}&week=${week}`,
          { cache: "no-store" },
        ).then((r) => r.json());
        const pArr = Array.isArray(j?.picks) ? j.picks : Array.isArray(j) ? j : [];
        setMyPicks(pArr);
      } catch (e) {
        console.error("Load my picks failed", e);
        setMyPicks([]);
      }
    })();
  }, [authReady, leagueId, season, week]);

  // 5) Standings — only when a league is selected
  useEffect(() => {
    if (!authReady || !leagueId) {
      setStandRows([]);
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/standings?leagueId=${leagueId}&season=${season}`, { cache: "no-store" });
        if (r.ok) {
          const s = await r.json();
          const rows = Array.isArray(s) ? s : s?.standings || s?.rows || [];
          setStandRows(rows || []);
        } else {
          setStandRows([]);
        }
      } catch {
        setStandRows([]);
      }
    })();
  }, [authReady, leagueId, season]);

  // Default week (Tue→Mon) when season changes (don’t override manual week pick)
  useEffect(() => {
    if (userPickedWeek) return;
    const computed = tuesdayToMondayWeekIndex(new Date());
    if (computed !== week) setWeek(computed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  /** simple map to find game by id (for points/status display) */
  const gameById = useMemo(() => {
    const m = new Map<string, GameCardGame>();
    for (const g of games) m.set(g.id, g);
    return m;
  }, [games]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">NFL Pick’em</h1>
        <div className="flex items-center gap-2">
          <AdminNavLink />
        </div>
      </header>

      {/* Filters */}
      <section className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">League</label>
          <select
            className="w-full rounded-lg border bg-transparent px-3 py-2"
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
          >
            {!leagueId && <option value="">—</option>}
            {leagues.map((L) => (
              <option key={L.id} value={L.id}>
                {L.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-neutral-500 mb-1">Season</label>
          <input
            type="number"
            className="w-full rounded-lg border bg-transparent px-3 py-2"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="block text-xs text-neutral-500 mb-1">Week</label>
          <select
            className="w-full rounded-lg border bg-transparent px-3 py-2"
            value={week}
            onChange={(e) => {
              setWeek(Number(e.target.value));
              setUserPickedWeek(true);
            }}
          >
            {Array.from({ length: 18 }).map((_, i) => {
              const wk = i + 1;
              return (
                <option key={wk} value={wk}>
                  {wk}
                </option>
              );
            })}
          </select>
        </div>
      </section>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-8 grid gap-6">
          <Card
            title="League overview"
            right={
              leagueId ? (
                <Link href={`/picks?leagueId=${leagueId}&season=${season}&week=${week}`} className="text-sm underline">
                  Make picks →
                </Link>
              ) : null
            }
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border px-4 py-3">
                <div className="text-xs text-neutral-500">Picks used</div>
                <div className="text-2xl font-semibold">{picksUsed}</div>
              </div>
              <div className="rounded-xl border px-4 py-3">
                <div className="text-xs text-neutral-500">Points (wk)</div>
                <div className="text-2xl font-semibold">{weekPoints}</div>
              </div>
              <div className="rounded-xl border px-4 py-3">
                <div className="text-xs text-neutral-500">Remaining</div>
                <div className="text-2xl font-semibold">{Math.max(0, picksAllowed - picksUsed)}</div>
              </div>
              <div className="rounded-xl border px-4 py-3">
                <div className="text-xs text-neutral-500">Locked</div>
                <div className="text-2xl font-semibold">{picksLocked}</div>
              </div>
            </div>
          </Card>

          <Card
            title={`Week ${week} — Games`}
            right={
              <div className="flex items-center gap-3">
                {leagueId && (
                  <Link href={`/picks?leagueId=${leagueId}&season=${season}&week=${week}`} className="text-sm underline">
                    Make picks →
                  </Link>
                )}
                <Link href="/scoreboard" className="text-xs underline">
                  Scoreboard →
                </Link>
              </div>
            }
          >
            {games.length === 0 ? (
              <div className="text-sm text-neutral-500">No games.</div>
            ) : (
              <div className="grid gap-4">
                {games.map((g) => (
                  <GameCard key={g.id} game={g} teamIndex={teamMap} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT */}
        <aside className="lg:col-span-4 grid gap-6">
          <Card
            title={`My picks — Week ${week}`}
            right={
              leagueId ? (
                <Link href={`/picks?leagueId=${leagueId}&season=${season}&week=${week}`} className="text-xs underline">
                  Edit on Picks →
                </Link>
              ) : null
            }
          >
            {!leagueId ? (
              <div className="text-sm text-neutral-500">Select a league to view your picks.</div>
            ) : myPicks.length === 0 ? (
              <div className="text-sm text-neutral-500">No picks yet.</div>
            ) : (
              <ul className="grid gap-2 max-h-64 overflow-auto pr-1">
                {myPicks.map((p) => {
                  const g = gameById.get(p.game_id || "");
                  const s = (g?.status || (gameLocked(g) ? "LIVE" : "UPCOMING")).toUpperCase();
                  const pts = pickPointsForGame(p.team_id, g);
                  const abbr =
                    (g?.home.id === p.team_id ? g.home.abbr : undefined) ||
                    (g?.away.id === p.team_id ? g.away.abbr : undefined) ||
                    "—";
                  return (
                    <li key={p.id} className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 dark:bg-neutral-800 px-3 py-1 text-sm">
                        <span className="font-semibold">{abbr}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {typeof pts === "number" && <span className="text-[10px] font-bold">{pts} pts</span>}
                        <span className="text-[10px] uppercase tracking-wide text-neutral-500">{s}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Placeholder until we wire your real endpoint back in */}
          <Card
            title="League picks (locked)"
            right={leagueId ? <Link href={`/standings?leagueId=${leagueId}&season=${season}`} className="text-xs underline">Standings →</Link> : null}
          >
            <div className="text-sm text-neutral-500">No locked picks yet.</div>
          </Card>

          <Card
            title="Standings (mini)"
            right={
              leagueId ? (
                <Link href={`/standings?leagueId=${leagueId}&season=${season}`} className="text-xs underline">
                  Full standings →
                </Link>
              ) : null
            }
          >
            {!leagueId ? (
              <div className="text-sm text-neutral-500">Select a league to view standings.</div>
            ) : standRows.length === 0 ? (
              <div className="text-sm text-neutral-500">No standings yet.</div>
            ) : (
              <ol className="grid gap-2">
                {standRows.map((r: any, idx: number) => (
                  <li key={r.profile_id || r.id || idx} className="flex items-center justify-between">
                    <span className="truncate">{r.display_name || r.name || r.email || "Member"}</span>
                    <span className="text-sm font-semibold">{r.points_total ?? 0} pts</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </aside>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-xl font-bold mb-3">NFL Pick’em</h1>
          <div className="text-neutral-600">Loading…</div>
        </main>
      }
    >
      <HomeInner />
    </Suspense>
  );
}
