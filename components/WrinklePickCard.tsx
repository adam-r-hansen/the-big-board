"use client";

import { useEffect, useMemo, useState } from "react";

/** Normalizes every possible server shape into one object the UI can use. */
function extractWrinkleAndGame(payload: any) {
  // wrinkle can be under: data / row / wrinkle / rows[0]
  const wrinkle =
    payload?.wrinkle ??
    payload?.row ??
    (payload?.data?.id ? payload.data : null) ??
    (Array.isArray(payload?.rows) && payload.rows.length ? payload.rows[0] : null);

  // game can be under: linkedGame / game / games[0] / wrinkle_linked_game
  const linkedGameRaw =
    payload?.linkedGame ??
    payload?.game ??
    (Array.isArray(payload?.games) && payload.games.length ? payload.games[0] : null) ??
    payload?.wrinkle_linked_game ??
    null;

  // final fallback: if API also returned wrinkleGames [{ normalized, game, wrinkle_game }]
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

type Props = {
  leagueId?: string | null;
  season: number | string;
  week: number | string;
};

export default function WrinklePickCard({ leagueId, season, week }: Props) {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    wrinkle: any | null;
    game: { id: string | null; home: string | null; away: string | null; kickoff: string | null; status: string | null; season: any; week: any } | null;
  }>({
    loading: true,
    error: null,
    wrinkle: null,
    game: null,
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
          setState({ loading: false, error: msg, wrinkle: null, game: null });
          return;
        }
        const { wrinkle, game } = extractWrinkleAndGame(json);
        setState({ loading: false, error: null, wrinkle: wrinkle ?? null, game: game ?? null });
      })
      .catch((e) => {
        if (!alive) return;
        setState({ loading: false, error: e?.message ?? "Network error", wrinkle: null, game: null });
      });
    return () => {
      alive = false;
    };
  }, [qs]);

  const { wrinkle, game, loading, error } = state;

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
          {!loading && !error && !game && <span>No linked game.</span>}
          {!loading && !error && game && (
            <div className="mt-2 rounded-lg bg-white p-3 shadow-sm">
              <div className="text-sm text-neutral-700">
                <div className="font-medium">
                  {game.away ?? "TBD"} @ {game.home ?? "TBD"}
                </div>
                {game.kickoff && (
                  <div className="text-xs text-neutral-500">
                    Kickoff: {new Date(game.kickoff).toLocaleString()}
                  </div>
                )}
                {game.status && (
                  <div className="text-xs text-neutral-500">
                    Status: {game.status}
                  </div>
                )}
              </div>
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
