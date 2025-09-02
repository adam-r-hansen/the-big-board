"use client";

import { useEffect, useMemo, useState } from "react";

/** Try to pull the Supabase access token from localStorage (client-side). */
function getSupabaseAccessTokenFromLocalStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || "";
      // Supabase auth key pattern: sb-<projectRef>-auth-token
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        // Values are usually JSON: ["access","refresh"] OR { currentSession:{access_token}, access_token:..., ... }
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && typeof parsed[0] === "string" && parsed[0]) return parsed[0];
          const direct = (parsed as any)?.access_token;
          if (typeof direct === "string" && direct) return direct;
          const nested = (parsed as any)?.currentSession?.access_token;
          if (typeof nested === "string" && nested) return nested;
        } catch {
          // Some setups might store raw token string (rare)
          if (raw && raw.length > 100) return raw; // heuristic: JWT length
        }
      }
    }
  } catch {
    // localStorage unavailable
  }
  return null;
}

async function readApiError(res: Response) {
  try {
    const j = await res.json();
    return j?.error?.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/** Normalizes every possible server shape into one object the UI can use. */
function extractWrinkleAndGame(payload: any) {
  const wrinkle =
    payload?.wrinkle ??
    payload?.row ??
    (payload?.data?.id ? payload.data : null) ??
    (Array.isArray(payload?.rows) && payload.rows.length ? payload.rows[0] : null);

  const linkedGameRaw =
    payload?.linkedGame ??
    payload?.game ??
    (Array.isArray(payload?.games) && payload.games.length ? payload.games[0] : null) ??
    payload?.wrinkle_linked_game ??
    null;

  const fallbackFromWrinkleGames = (() => {
    const wg0 =
      Array.isArray(payload?.wrinkleGames) && payload.wrinkleGames.length
        ? payload.wrinkleGames[0]
        : null;
    return wg0?.normalized ?? wg0?.game ?? null;
  })();

  const g = linkedGameRaw ?? fallbackFromWrinkleGames ?? null;
  if (!g) return { wrinkle, game: null };

  const pick = <T,>(...vals: T[]) => vals.find((v) => v !== undefined && v !== null);

  const home =
    pick(g.homeTeamId, g.home_team_id, g.home_team) ??
    pick(g.homeTeam, g.home) ??
    null;

  const away =
    pick(g.awayTeamId, g.away_team_id, g.away_team) ??
    pick(g.awayTeam, g.away) ??
    null;

  const kickoff =
    pick(g.gameUtc, g.game_utc, g.startUtc, g.start_utc) ??
    null;

  const status = pick(g.status, g.game_status) ?? null;
  const season = pick(g.season) ?? null;
  const week = pick(g.week) ?? null;
  const id = pick(g.id, g.game_id) ?? null;

  return {
    wrinkle,
    game: { id, home, away, kickoff, status, season, week },
  };
}

type TeamLike = {
  id?: string | null;
  abbr?: string | null;   // e.g., PHI
  short?: string | null;  // e.g., Eagles
  name?: string | null;   // e.g., Philadelphia Eagles
};

function resolveTeamLabel(
  teamId: string | null | undefined,
  teams?: Record<string, TeamLike>
): string {
  if (!teamId) return "TBD";
  const t = teams?.[teamId];
  const val = t?.abbr ?? t?.short ?? t?.name ?? null;
  if (val && typeof val === "string" && val.trim().length > 0) return val;
  return teamId.slice(0, 6).toUpperCase();
}

type Props = {
  leagueId?: string | null;
  season: number | string;
  week: number | string;
  /** Optional map of teamId -> { abbr/short/name }, nullables allowed */
  teams?: Record<string, TeamLike>;
};

export default function SpecialPicksCard({ leagueId, season, week, teams }: Props) {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    wrinkle: any | null;
    game: {
      id: string | null;
      home: string | null;
      away: string | null;
      kickoff: string | null;
      status: string | null;
      season: any;
      week: any;
    } | null;
    saving: boolean;
    lastPickTeamId: string | null;
  }>({
    loading: true,
    error: null,
    wrinkle: null,
    game: null,
    saving: false,
    lastPickTeamId: null,
  });

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (leagueId) p.set("leagueId", leagueId);
    p.set("season", String(season));
    p.set("week", String(week));
    return p.toString();
  }, [leagueId, season, week]);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetch(`/api/wrinkles/active?${qs}`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok || json?.ok === false) {
          const msg = json?.error?.message || `HTTP ${res.status}`;
          setState((s) => ({ ...s, loading: false, error: msg, wrinkle: null, game: null }));
          return;
        }
        const { wrinkle, game } = extractWrinkleAndGame(json);
        setState((s) => ({
          ...s,
          loading: false,
          error: null,
          wrinkle: wrinkle ?? null,
          game: game ?? null,
        }));
      })
      .catch((e) => {
        if (!alive) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: e?.message ?? "Network error",
          wrinkle: null,
          game: null,
        }));
      });
    return () => {
      alive = false;
    };
  }, [qs]);

  const { wrinkle, game, loading, error, saving, lastPickTeamId } = state;

  const homeLabel = resolveTeamLabel(game?.home, teams);
  const awayLabel = resolveTeamLabel(game?.away, teams);

  async function savePick(teamId: string | null) {
    if (!wrinkle?.id || !teamId) return;
    setState((s) => ({ ...s, saving: true, lastPickTeamId: teamId }));

    // Get a bearer token explicitly (works even when server can’t read cookies)
    const bearer = getSupabaseAccessTokenFromLocalStorage();

    try {
      const res = await fetch(`/api/wrinkles/${wrinkle.id}/picks`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify({ selection: teamId, teamId }),
      });

      if (!res.ok) {
        alert(await readApiError(res));
        setState((s) => ({ ...s, saving: false }));
        return;
      }

      alert("Wrinkle pick saved!");
      setState((s) => ({ ...s, saving: false }));
    } catch (e: any) {
      alert(e?.message ?? "Network error");
      setState((s) => ({ ...s, saving: false }));
    }
  }

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50/50 p-6">
      <h2 className="text-2xl font-semibold">Wrinkle Pick</h2>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-amber-400 bg-white px-3 py-1 text-xs font-semibold text-amber-700">
              {String(wrinkle?.kind ?? "BONUS_GAME").toUpperCase()}
            </span>
            <h3 className="text-xl font-semibold">
              {wrinkle?.name ?? "Special Pick"}
            </h3>
          </div>
        </div>

        <div className="mt-3 text-neutral-600">
          {loading && <span>Loading linked game…</span>}
          {!loading && error && <span className="text-red-700">Error: {error}</span>}

          {/* Game summary */}
          {!loading && !error && game && (
            <div className="mt-2 rounded-lg bg-white p-3 shadow-sm">
              <div className="text-sm text-neutral-700">
                <div className="font-medium">
                  {awayLabel} @ {homeLabel}
                </div>
                {game.kickoff && (
                  <div className="text-xs text-neutral-500">
                    Kickoff: {new Date(game.kickoff).toLocaleString()}
                  </div>
                )}
                {game.status && (
                  <div className="text-xs text-neutral-500">Status: {game.status}</div>
                )}
              </div>
            </div>
          )}

          {/* No linked game */}
          {!loading && !error && !game && <span>No linked game.</span>}

          {/* Pick buttons */}
          {!loading && !error && game && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => savePick(game.away)}
                disabled={saving || !game.away}
                className="rounded-md border px-4 py-2 text-sm shadow-sm disabled:opacity-50"
                title={game.away ?? undefined}
              >
                {saving && lastPickTeamId === game.away ? "Saving…" : `Pick ${awayLabel}`}
              </button>
              <button
                onClick={() => savePick(game.home)}
                disabled={saving || !game.home}
                className="rounded-md border px-4 py-2 text-sm shadow-sm disabled:opacity-50"
                title={game.home ?? undefined}
              >
                {saving && lastPickTeamId === game.home ? "Saving…" : `Pick ${homeLabel}`}
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-base text-amber-800">
          Special pick — doesn’t count toward weekly limit
        </p>
      </div>
    </div>
  );
}
