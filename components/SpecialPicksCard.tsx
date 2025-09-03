// components/SpecialPicksCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WrinklePickButton from "./WrinklePickButton";

type TeamLike = {
  abbreviation?: string | null;
  name?: string | null;
  color_primary?: string | null;
  color_secondary?: string | null;
};

type Wrinkle = {
  id: string;
  name: string;
  kind: string; // e.g., 'bonus_game'
};

type WrinkleGame = {
  id: string; // game id
  home_team: string;
  away_team: string;
  game_utc?: string | null;
  status?: string | null;
};

type Props = {
  leagueId: string;
  season: number;
  week: number;
  teams: Record<string, TeamLike>;
};

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function fmtTime(iso?: string | null) {
  if (!iso) return "TBD";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "TBD";
  }
}

export default function SpecialPicksCard({ leagueId, season, week, teams }: Props) {
  const [loading, setLoading] = useState(true);
  const [wrinkle, setWrinkle] = useState<Wrinkle | null>(null);
  const [game, setGame] = useState<WrinkleGame | null>(null);
  const [myPick, setMyPick] = useState<{ id: string; team_id: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const home = useMemo(() => (game ? teams[game.home_team] : undefined), [game, teams]);
  const away = useMemo(() => (game ? teams[game.away_team] : undefined), [game, teams]);

  // Load the active wrinkle (and its linked game, if any)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setMsg(null);
      try {
        const qs = new URLSearchParams({
          leagueId,
          season: String(season),
          week: String(week),
        });
        const res = await fetch(`/api/wrinkles/active?${qs.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        const j = await safeJson(res);
        if (!cancelled) {
          if (!res.ok || !j?.wrinkle) {
            setWrinkle(null);
            setGame(null);
            setMyPick(null);
            return;
          }
          setWrinkle(j.wrinkle);
          setGame(j.game ?? null);

          // load my wrinkle pick (if exists)
          try {
            const pRes = await fetch(`/api/wrinkles/${j.wrinkle.id}/picks`, {
              credentials: "include",
              cache: "no-store",
            });
            const pj = await safeJson(pRes);
            const p = Array.isArray(pj?.picks) ? pj.picks[0] : pj?.pick ?? null;
            setMyPick(p ? { id: p.id, team_id: p.team_id } : null);
          } catch {
            setMyPick(null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [leagueId, season, week]);

  async function pickTeam(teamId: string) {
    if (!wrinkle || !game) return;
    setMsg(null);
    const res = await fetch(`/api/wrinkles/${wrinkle.id}/picks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        teamId,
        gameId: game.id,
        leagueId, // harmless
      }),
    });
    const j = await safeJson(res);
    if (!res.ok) {
      setMsg(j?.error || "Failed to save wrinkle pick");
      return;
    }
    // Re-read my pick
    const pRes = await fetch(`/api/wrinkles/${wrinkle.id}/picks`, {
      credentials: "include",
      cache: "no-store",
    });
    const pj = await safeJson(pRes);
    const p = Array.isArray(pj?.picks) ? pj.picks[0] : pj?.pick ?? null;
    setMyPick(p ? { id: p.id, team_id: p.team_id } : null);
    setMsg("Wrinkle pick saved");
  }

  async function unpick() {
    if (!wrinkle || !myPick) return;
    setMsg(null);
    const res = await fetch(`/api/wrinkles/${wrinkle.id}/picks?id=${encodeURIComponent(myPick.id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const j = await safeJson(res);
    if (!res.ok) {
      setMsg(j?.error || "Failed to remove wrinkle pick");
      return;
    }
    setMyPick(null);
    setMsg("Wrinkle pick removed");
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-yellow-300/40 bg-yellow-50/50 p-4">
        <div className="text-sm text-neutral-500">Loading wrinkle…</div>
      </section>
    );
  }

  if (!wrinkle) {
    return (
      <section className="rounded-2xl border border-yellow-300/40 bg-yellow-50/50 p-4">
        <h3 className="mb-2 text-lg font-semibold">Wrinkle Pick</h3>
        <div className="text-sm text-neutral-600">No active wrinkle this week.</div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-yellow-300/50 bg-yellow-50/60 p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
          {wrinkle.kind?.toUpperCase() || "WRINKLE"}
        </span>
        <h3 className="text-xl font-semibold">{wrinkle.name || "Special Pick"}</h3>
      </div>

      {game ? (
        <div className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="mb-1 text-sm text-neutral-500">
            {teams[game.away_team]?.abbreviation || "Away"} @{" "}
            {teams[game.home_team]?.abbreviation || "Home"} • Kickoff: {fmtTime(game.game_utc)} • Status:{" "}
            {game.status || "UPCOMING"}
          </div>

          <div className="flex items-center justify-between gap-3">
            {/* Away */}
            <WrinklePickButton
              picked={!!myPick && myPick.team_id === game.away_team}
              disabled={false}
              teamId={game.away_team}
              teams={teams}
              onPick={() => pickTeam(game.away_team)}
              onUnpick={unpick}
            >
              {teams[game.away_team]?.abbreviation || "Away"}
            </WrinklePickButton>

            <div className="select-none text-sm font-medium text-neutral-500">at</div>

            {/* Home */}
            <WrinklePickButton
              picked={!!myPick && myPick.team_id === game.home_team}
              disabled={false}
              teamId={game.home_team}
              teams={teams}
              onPick={() => pickTeam(game.home_team)}
              onUnpick={unpick}
            >
              {teams[game.home_team]?.abbreviation || "Home"}
            </WrinklePickButton>
          </div>
        </div>
      ) : (
        <div className="text-sm text-neutral-600">No linked game.</div>
      )}

      <div className="text-sm text-amber-800">Special pick — doesn’t count toward weekly limit</div>
      {msg && <div className="mt-2 text-sm text-neutral-600">{msg}</div>}
    </section>
  );
}

