'use client'

// app/page.tsx — Home with locked-picks grouping + points + no clipping

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import GameCard, { type GameCardGame } from "@/components/ui/GameCard";
import AdminNavLink from "@/components/AdminNavLink";
import type { TeamShape } from "@/components/ui/TeamPill";
import TeamCard from "@/components/TeamCard";
import { createClient as createSupabaseClient } from "@/utils/supabase/client";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Tue→Mon NFL week helper */
function tuesdayToMondayWeekIndex(d: Date) {
  const year = d.getFullYear();
  const sept1 = new Date(year, 8, 1);
  const day = sept1.getDay(); // 0..6
  const offsetToTue = (9 - day) % 7; // Tue=2
  const firstTue = new Date(year, 8, 1 + offsetToTue);
  const diffDays = Math.floor((d.getTime() - firstTue.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

/** Types */
type League = { id: string; name: string; season: number };
type TeamMap = Record<string, TeamShape>;
type Pick = {
  id: string;
  team_id: string;
  game_id?: string | null;
  status?: "UPCOMING" | "LIVE" | "FINAL" | string;
  points?: number | null;
  winless_double?: boolean;
};
type MemberLockedPicks = {
  profile_id: string;
  display_name?: string | null;
  preferred_color?: string | null;
  points_week?: number | null;
  picks?: Array<{ team_id: string; status?: string; points?: number | null; winless_double?: boolean }>;
};

/** Reusable card */
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

/** Helpers */
function gameLocked(g?: GameCardGame | null) {
  if (!g) return false;
  const s = (g?.status || "").toUpperCase();
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

/** EXACT scoreboard normalizer */
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

/** Try a list of URLs until one returns OK JSON */
async function tryJson<T = any>(urls: string[]): Promise<T | null> {
  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      return (await r.json()) as T;
    } catch {
      // ignore and try next
    }
  }
  return null;
}

/** Normalize `members` shape straight-through */
function normalizeLockedMembersShape(raw: any): MemberLockedPicks[] {
  if (!raw || !Array.isArray(raw.members)) return [];
  return raw.members.map((m: any) => ({
    profile_id: m.profile_id ?? m.user_id ?? m.id ?? String(Math.random()),
    display_name: m.display_name ?? m.name ?? m.username ?? null,
    preferred_color: m.preferred_color ?? m.preferredColor ?? null,
    points_week: m.points_week ?? m.week_points ?? m.points ?? 0,
    picks: Array.isArray(m.picks)
      ? m.picks.map((p: any) => ({
          team_id: p.team_id ?? p.team ?? p.teamId ?? p.abbr ?? p.abbreviation ?? "",
          status: p.status ?? p.state ?? undefined,
          points: p.points ?? p.pts ?? undefined,
          winless_double: p.winless_double ?? false,
        }))
      : [],
  }));
}

/** Group row-per-pick payloads into MemberLockedPicks[] */
function groupLockedFromRows(raw: any): MemberLockedPicks[] {
  const rows: any[] =
    (Array.isArray(raw) && raw) ||
    raw?.rows ||
    raw?.data ||
    [];

  if (!Array.isArray(rows)) return [];

  const byMember = new Map<string, MemberLockedPicks>();

  const getName = (r: any) =>
    (r.display_name && String(r.display_name)) ||
    (r.name && String(r.name)) ||
    (r.profiles?.display_name && String(r.profiles.display_name)) ||
    (r.profiles?.full_name && String(r.profiles.full_name)) ||
    (r.profiles?.email ? String(r.profiles.email).split("@")[0] : "") ||
    "Member";

  for (const r of rows) {
    const profile_id: string =
      r.profile_id || r.profileId || r.user_id || r.userId || r.profiles?.id || "unknown";

    const team_id: string =
      r.team_id || r.teamId || r.team?.id || r.team?.team_id || r.team_abbr || r.abbr || r.abbreviation || "";

    const statusRaw: string = r.status || r.game_status || r.state || "";
    const status = statusRaw ? String(statusRaw).toUpperCase() : undefined;

    const rowPoints =
      typeof r.points === "number"
        ? r.points
        : typeof r.pick_points === "number"
        ? r.pick_points
        : null;

    const winlessDouble = r.winless_double ?? false;
    
    const preferredColor = r.preferred_color || r.preferredColor || null;

    let entry = byMember.get(profile_id);
    if (!entry) {
      entry = {
        profile_id,
        display_name: getName(r),
        preferred_color: preferredColor,
        points_week: 0,
        picks: [],
      };
      byMember.set(profile_id, entry);
    }

    if (team_id) {
      entry.picks!.push({ team_id, status, points: rowPoints, winless_double: winlessDouble });
    }

    if (typeof rowPoints === "number") {
      entry.points_week = (entry.points_week ?? 0) + rowPoints;
    }
  }

  return Array.from(byMember.values()).sort((a, b) =>
    (a.display_name || "").localeCompare(b.display_name || ""),
  );
}

/** Normalize standings to simple rows */
function normalizeStandings(raw: any): Array<{ profile_id?: string; display_name?: string; points_total?: number }> {
  const arr =
    (Array.isArray(raw) && raw) ||
    raw?.standings ||
    raw?.rows ||
    raw?.data ||
    [];
  if (!Array.isArray(arr)) return [];
  return arr.map((r: any) => ({
    profile_id: r.profile_id ?? r.user_id ?? r.id,
    display_name: r.display_name ?? r.name ?? r.username ?? r.email ?? "Member",
    points_total: r.points_total ?? r.total_points ?? r.points ?? 0,
  }));
}

function getTeam(teamId: string, teamMap: TeamMap) {
  const team = teamMap[teamId] || teamMap[teamId?.toUpperCase()];
  if (!team) return null;
  
  return {
    id: team.id || '',
    name: (team as any)?.name || '',
    short_name: (team as any)?.short_name || (team as any)?.name || '',
    abbreviation: (team as any)?.abbreviation || '',
    logo: (team as any)?.logo || '',
    color_primary: (team as any)?.color_primary || '#6b7280',
    color_secondary: (team as any)?.color_secondary,
    color_pref_light: (team as any)?.color_pref_light,
    color_pref_dark: (team as any)?.color_pref_dark,
  };
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
  const [locked, setLocked] = useState<MemberLockedPicks[]>([]);
  const [authReady, setAuthReady] = useState(false);

  const picksUsed = myPicks.length;
  const picksAllowed = 2;
  const picksLocked = myPicks.filter((p) => p.status === "FINAL" || p.status === "LIVE").length;
  const weekPoints = myPicks.reduce((acc, p) => acc + (typeof p.points === "number" ? p.points : 0), 0);

  // Auth cleanup
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    (async () => {
      try {
        if (code) {
          const supabase = createSupabaseClient();
          await supabase.auth.exchangeCodeForSession(code);
          const AUTH_PARAMS = ["code","type","scope","auth_callback","next","redirect_to","provider","refresh_token","access_token"];
          const clean = new URL(window.location.href);
          AUTH_PARAMS.forEach((p) => clean.searchParams.delete(p));
          window.history.replaceState({}, "", clean.toString());
        }
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  // Team map
  useEffect(() => {
    if (!authReady) return;
    (async () => {
      try {
        const tm = await fetch("/api/team-map", { cache: "no-store" }).then((r) => r.json());
        setTeamMap((tm?.teams || {}) as TeamMap);
      } catch {
        setTeamMap({});
      }
    })();
  }, [authReady]);

  // Leagues (auto-select first)
  useEffect(() => {
    if (!authReady) return;
    (async () => {
      try {
        const r = await fetch("/api/my-leagues", { cache: "no-store" });
        if (r.ok) {
          const data = await r.json();
          const L: League[] = Array.isArray(data?.leagues) ? data.leagues : data?.rows || data || [];
          setLeagues(L);
          if (L.length > 0) {
            setLeagueId((prev) => prev || L[0].id);
            setSeason(L[0].season || new Date().getFullYear());
          }
        }
      } catch {}
    })();
  }, [authReady]);

  // Games
  useEffect(() => {
    if (!authReady) return;
    (async () => {
      try {
        const j = await fetch(`/api/games-for-week?season=${season}&week=${week}`, { cache: "no-store" }).then((r) => r.json());
        setGames(normalizeGamesForCard(j?.games || j || []));
      } catch {
        setGames([]);
      }
    })();
  }, [authReady, season, week]);

  // My picks (needs league)
  useEffect(() => {
    if (!authReady || !leagueId) { setMyPicks([]); return; }
    (async () => {
      try {
        const j = await fetch(`/api/my-picks?leagueId=${encodeURIComponent(leagueId)}&season=${season}&week=${week}`, { cache: "no-store" }).then((r) => r.json());
        setMyPicks(Array.isArray(j?.picks) ? j.picks : Array.isArray(j) ? j : []);
      } catch {
        setMyPicks([]);
      }
    })();
  }, [authReady, leagueId, season, week]);

  // Standings
  useEffect(() => {
    if (!authReady || !leagueId) { setStandRows([]); return; }
    (async () => {
      const base = `leagueId=${leagueId}&season=${season}`;
      const raw = await tryJson([
        `/api/standings?${base}`,
        `/api/league-standings?${base}`,
        `/api/mini-standings?${base}`,
      ]);
      setStandRows(normalizeStandings(raw));
    })();
  }, [authReady, leagueId, season]);

  // Locked picks
  useEffect(() => {
    if (!authReady || !leagueId) { setLocked([]); return; }
    (async () => {
      const base = `leagueId=${leagueId}&season=${season}&week=${week}`;
      const raw = await tryJson([
        `/api/league-picks-week?${base}`,
        `/api/league-locked?${base}`,
        `/api/league-locked-picks?${base}`,
        `/api/locked-picks?${base}`,
        `/api/picks-locked?${base}`,
      ]);

      if (!raw) { setLocked([]); return; }

      if (Array.isArray((raw as any).members)) {
        setLocked(normalizeLockedMembersShape(raw));
      } else {
        setLocked(groupLockedFromRows(raw));
      }
    })();
  }, [authReady, leagueId, season, week]);

  // Keep Tue→Mon default unless user picked manually
  useEffect(() => {
    if (userPickedWeek) return;
    setWeek(tuesdayToMondayWeekIndex(new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  const gameById = useMemo(() => {
    const m = new Map<string, GameCardGame>();
    for (const g of games) m.set(g.id, g);
    return m;
  }, [games]);

  // Helper to compute derived points for a member's picks if API didn't supply them
  const withDerivedPickPoints = (m: MemberLockedPicks): { picks: Required<MemberLockedPicks>["picks"]; total: number } => {
    let total = 0;
    const picks = (m.picks || []).map((pk) => {
      const teamId = pk.team_id;
      const g = games.find((gg) => gg.home.id === teamId || gg.away.id === teamId);
      const computed = pickPointsForGame(teamId, g);
      const points = typeof pk.points === "number" ? pk.points : computed;
      if (typeof points === "number") total += points;
      return { ...pk, points };
    });
    return { picks, total };
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">NFL Pick'em</h1>
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
          {/* Overview */}
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

          {/* Games */}
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
          {/* My Picks */}
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
              <ul className="grid gap-2">
                {myPicks.map((p) => {
                  const team = getTeam(p.team_id, teamMap);
                  const g = games.find((gg) => gg.home.id === p.team_id || gg.away.id === p.team_id);
                  const s = (g?.status || (gameLocked(g) ? "LIVE" : "UPCOMING")).toUpperCase();
                  const pts = pickPointsForGame(p.team_id, g);
                  return (
                    <li key={p.id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        {team && (
                          <TeamCard
                            team={team}
                            variant="solid"
                            displayText="abbreviation"
                            disabled
                            className="w-full"
                          />
                        )}
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <div className="flex items-center gap-1">
                          {typeof pts === "number" && <span className="text-[10px] font-bold">{pts} pts</span>}
                          {p.winless_double && <span className="text-[8px] font-bold bg-purple-600 text-white px-1 py-0.5 rounded">2×</span>}
                        </div>
                        <span className="text-[10px] uppercase tracking-wide text-neutral-500">{s}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* League picks (locked) */}
          <Card title="League picks (locked)">
            {!leagueId ? (
              <div className="text-sm text-neutral-500">Select a league to view locked picks.</div>
            ) : locked.length === 0 ? (
              <div className="text-sm text-neutral-500">No locked picks yet.</div>
            ) : (
              <ul className="grid gap-3">
                {locked.map((m) => {
                  const { picks, total } = withDerivedPickPoints(m);
                  const totalToShow = Math.max(total, Number(m.points_week ?? 0));
                  const borderColor = m.preferred_color || '#000000';
                  return (
                    <li 
                      key={m.profile_id} 
                      className="rounded-xl px-3 py-2"
                      style={{ 
                        border: `3px solid ${borderColor}` 
                      }}
                    >
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium">{m.display_name || "Member"}</span>
                        <span className="text-neutral-600">{totalToShow} pts</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {picks.length > 0 ? (
                          picks.map((pk, idx) => {
                            const team = getTeam(pk.team_id, teamMap);
                            return (
                              <div key={`${m.profile_id}-${idx}`} className="flex flex-col gap-1">
                                {team && (
                                  <TeamCard
                                    team={team}
                                    variant="solid"
                                    displayText="abbreviation"
                                    disabled
                                    className="w-full"
                                  />
                                )}
                                <div className="flex items-center justify-center gap-1">
                                  {typeof pk.points === "number" && (
                                    <span className="text-[10px] font-semibold">{pk.points} pts</span>
                                  )}
                                  {pk.winless_double && (
                                    <span className="text-[8px] font-bold bg-purple-600 text-white px-1 py-0.5 rounded">2×</span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-xs text-neutral-500 col-span-2">No locked picks yet.</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Standings (mini) */}
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
                    <span className="truncate">{r.display_name || "Member"}</span>
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
          <h1 className="text-xl font-bold mb-3">NFL Pick'em</h1>
          <div className="text-neutral-600">Loading…</div>
        </main>
      }
    >
      <HomeInner />
    </Suspense>
  );
}
