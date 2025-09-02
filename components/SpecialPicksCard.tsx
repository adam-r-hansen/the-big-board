"use client";

import { useEffect, useMemo, useState } from "react";

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
    pick(g.gameUtc, g.game_utc, g.startUtc, g.start_utc) ?? null;

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
  abbr?: string | null;   // PHI
  short?: string | null;  // Eagles
  name?: string | null;   // Philadelphia Eagles
};

function resolveTeamLabel(id: string | null | undefined, teams?: Record<string, TeamLike>): string {
  if (!id) return "TBD";
  const t = teams?.[id];
  const val = t?.abbr ?? t?.short ?? t?.name ?? null;
  return val && val.trim() ? val : id.slice(0, 6).toUpperCase();
}

async function readApiError(res: Response) {
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      return j?.error?.message || j?.error || j?.message || `HTTP ${res.status}`;
    } catch {
      return text || `HTTP ${res.status}`;
    }
  } catch {
    return `HTTP ${res.status}`;
  }
}

/**
 * Weekly flow posts to /api/picks with:
 * { leagueId, season, week, teamId, gameId }
 */
async function postWeeklyPick(
  gameId: string,
  body: { teamId: string; leagueId?: string | null; season?: number | string; week?: number | string; wrinkleId?: string | null }
): Promise<Response> {
  const payload = {
    leagueId: body.leagueId ?? null,
    season: body.season ?? null,
    week: body.week ?? null,
    teamId: body.teamId,
    gameId,
    // harmless extra (ignored by backend if unknown):
    wrinkleId: body.wrinkleId ?? null,
  };
  return fetch('/api/picks', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/** Unpick via the same weekly endpoint */
async function deleteWeeklyPickByGame(q: { leagueId: string; season: number | string; week: number | string; gameId: string }) {
  const qs = new URLSearchParams({
    leagueId: q.leagueId,
    season: String(q.season),
    week: String(q.week),
    gameId: q.gameId,
  });
  return fetch(`/api/picks?${qs.toString()}`, {
    method: "DELETE",
    credentials: "include",
    cache: "no-store",
  });
}

type Props = {
  leagueId?: string | null;
  season: number | string;
  week: number | string;
  teams?: Record<string, TeamLike>;
};

export default function SpecialPicksCard({ leagueId, season, week, teams }: Props) {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    wrinkle: any | null;
    game: { id: string | null; home: string | null; away: string | null; kickoff: string | null; status: string | null; season: any; week: any } | null;
    saving: boolean;
    lastPickTeamId: string | null;
    // selection
    selectedTeamId: string | null;
    locked: boolean;
  }>({
    loading: true,
    error: null,
    wrinkle: null,
    game: null,
    saving: false,
    lastPickTeamId: null,
    selectedTeamId: null,
    locked: false,
  });

  // ---- load wrinkle + linked game
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (leagueId) p.set("leagueId", leagueId);
    p.set("season", String(season));
    p.set("week", String(week));
    return p.toString();
  }, [leagueId, season, week]);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null, selectedTeamId: null, locked: false }));
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
        setState((s) => ({ ...s, loading: false, wrinkle: wrinkle ?? null, game: game ?? null, error: null }));
      })
      .catch((e) => {
        if (!alive) return;
        setState((s) => ({ ...s, loading: false, error: e?.message ?? "Network error", wrinkle: null, game: null }));
      });
    return () => { alive = false; };
  }, [qs]);

  // ---- after we know the game, load my picks to see if this game is already picked
  useEffect(() => {
    let alive = true;
    async function loadSelection() {
      if (!leagueId || !state.game?.id) return;
      try {
        const r = await fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        const arr: { id: string; team_id: string; game_id: string | null }[] = Array.isArray(j?.picks) ? j.picks : [];
        const mine = arr.find((p) => p.game_id === state.game!.id);
        const locked = (() => {
          const ko = state.game?.kickoff ? new Date(state.game.kickoff) : null;
          return !!(ko && ko <= new Date());
        })();
        setState((s) => ({ ...s, selectedTeamId: mine?.team_id ?? null, locked }));
      } catch {
        /* ignore */
      }
    }
    loadSelection();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, season, week, state.game?.id]);

  const { wrinkle, game, loading, error, saving, lastPickTeamId, selectedTeamId, locked } = state;

  const homeLabel = resolveTeamLabel(game?.home, teams);
  const awayLabel = resolveTeamLabel(game?.away, teams);

  function missingFields(): string[] {
    const m: string[] = [];
    if (!leagueId) m.push("leagueId");
    if (!(season ?? "").toString().trim()) m.push("season");
    if (!(week ?? "").toString().trim()) m.push("week");
    if (!game?.id) m.push("gameId");
    return m;
  }

  async function savePick(teamId: string | null) {
    if (!game?.id || !teamId || locked) return;
    const miss = missingFields();
    if (miss.length) { alert(`Missing fields: ${miss.join(", ")}`); return; }

    setState((s) => ({ ...s, saving: true, lastPickTeamId: teamId }));
    try {
      const res = await postWeeklyPick(game.id, {
        teamId,
        leagueId: leagueId ?? null,
        season,
        week,
        wrinkleId: wrinkle?.id ?? null,
      });
      if (!res.ok) {
        const msg = await readApiError(res);
        alert(msg);
        setState((s) => ({ ...s, saving: false }));
        return;
      }
      // refresh selection
      const r = await fetch(`/api/my-picks?leagueId=${leagueId}&season=${season}&week=${week}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      const arr: { id: string; team_id: string; game_id: string | null }[] = Array.isArray(j?.picks) ? j.picks : [];
      const mine = arr.find((p) => p.game_id === game.id);
      setState((s) => ({ ...s, saving: false, selectedTeamId: mine?.team_id ?? teamId }));
      alert("Wrinkle pick saved!");
    } catch (e: any) {
      alert(e?.message ?? "Network error");
      setState((s) => ({ ...s, saving: false }));
    }
  }

  async function unpick() {
    if (!leagueId || !game?.id || locked) return;
    setState((s) => ({ ...s, saving: true }));
    try {
      const res = await deleteWeeklyPickByGame({ leagueId, season, week, gameId: game.id });
      if (!res.ok) {
        const msg = await readApiError(res);
        alert(msg);
        setState((s) => ({ ...s, saving: false }));
        return;
      }
      setState((s) => ({ ...s, saving: false, selectedTeamId: null, lastPickTeamId: null }));
      alert("Wrinkle pick removed.");
    } catch (e: any) {
      alert(e?.message ?? "Network error");
      setState((s) => ({ ...s, saving: false }));
    }
  }

  const btnClass = (active: boolean) =>
    `rounded-md border px-4 py-2 text-sm shadow-sm disabled:opacity-50 ${
      active ? "bg-black text-white border-black" : "bg-white"
    }`;

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50/50 p-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold">Wrinkle Pick</h2>
        {wrinkle?.name && <span className="text-sm text-amber-800">· {wrinkle.name}</span>}
        <span className="ml-auto inline-flex items-center rounded-full border border-amber-400 bg-white px-3 py-1 text-xs font-semibold text-amber-700">
          {String(wrinkle?.kind ?? "BONUS_GAME").toUpperCase()}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="text-neutral-600">
          {loading && <div className="text-sm text-neutral-500">Loading linked game…</div>}
          {!loading && error && <div className="text-sm text-red-700">Error: {error}</div>}

          {/* Summary */}
          {!loading && !error && game && (
            <div className="mt-2 rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm text-neutral-700">
                  <div className="font-medium">
                    {awayLabel} @ {homeLabel}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {game.kickoff ? `Kickoff: ${new Date(game.kickoff).toLocaleString()}` : "Kickoff: TBA"}
                    {game.status ? ` · Status: ${game.status}` : ""}
                  </div>
                </div>
                {selectedTeamId && (
                  <div className="text-xs rounded-full px-3 py-1 border bg-emerald-50 border-emerald-300 text-emerald-700">
                    Picked: {selectedTeamId === game.home ? homeLabel : selectedTeamId === game.away ? awayLabel : "?"}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-wrap gap-3 items-center">
                <button
                  onClick={() => savePick(game.away)}
                  disabled={saving || !game.away || locked}
                  className={btnClass(selectedTeamId === game.away)}
                  title={game.away ?? undefined}
                >
                  {saving && lastPickTeamId === game.away ? "Saving…" : `Pick ${awayLabel}`}
                </button>

                <button
                  onClick={() => savePick(game.home)}
                  disabled={saving || !game.home || locked}
                  className={btnClass(selectedTeamId === game.home)}
                  title={game.home ?? undefined}
                >
                  {saving && lastPickTeamId === game.home ? "Saving…" : `Pick ${homeLabel}`}
                </button>

                <button
                  onClick={unpick}
                  disabled={saving || !selectedTeamId || locked}
                  className="rounded-md border px-4 py-2 text-sm shadow-sm disabled:opacity-50"
                  title={locked ? "Locked (kickoff passed)" : "Remove your wrinkle pick"}
                >
                  {locked ? "Locked" : "Unpick"}
                </button>

                <div className="ml-auto text-xs text-neutral-500">
                  {locked ? "Locked (kickoff passed)" : "Special pick — doesn’t count toward weekly limit"}
                </div>
              </div>
            </div>
          )}

          {!loading && !error && !game && <div className="text-sm text-neutral-500">No linked game.</div>}
        </div>
      </div>
    </div>
  );
}
