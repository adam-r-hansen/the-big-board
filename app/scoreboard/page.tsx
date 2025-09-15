// app/scoreboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import GameCard, { type GameCardGame } from "@/components/ui/GameCard";
import type { TeamShape } from "@/components/ui/TeamPill";

type TeamMap = Record<string, TeamShape>;

function tuesdayToMondayWeekIndex(d: Date) {
  // Return NFL-style “week” number within the season window based on Tue→Mon
  // You likely already know the official week; this is a UX helper.
  // Start from NFL Week 1 Tuesday (change if needed).
  const year = d.getFullYear();
  // Heuristic: first Tuesday after Sept 1
  const sept1 = new Date(year, 8, 1);
  const day = sept1.getDay(); // 0..6
  const offsetToTue = (9 - day) % 7; // Tuesday = 2
  const firstTue = new Date(year, 8, 1 + offsetToTue);
  const diffDays = Math.floor((d.getTime() - firstTue.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

export default function ScoreboardPage() {
  const [season, setSeason] = useState<number>(new Date().getFullYear());
  const [week, setWeek] = useState<number>(tuesdayToMondayWeekIndex(new Date()));
  const [teamMap, setTeamMap] = useState<TeamMap>({});
  const [games, setGames] = useState<GameCardGame[]>([]);
  const [msg, setMsg] = useState("");

  function flash(s: string) {
    setMsg(s);
    setTimeout(() => setMsg(""), 2500);
  }

  useEffect(() => {
    (async () => {
      try {
        const tm = await fetch("/api/team-map", { cache: "no-store" }).then((r) => r.json());
        setTeamMap(tm?.teams || {});
      } catch (e: any) {
        flash(e?.message || "Failed to load teams");
      }
    })();
  }, []);

  useEffect(() => {
    if (!season || !week) return;
    (async () => {
      try {
        const j = await fetch(`/api/games-for-week?season=${season}&week=${week}`, { cache: "no-store" }).then((r) =>
          r.json(),
        );
        const rows = (j?.games || j || []) as any[];
        const norm: GameCardGame[] = rows.map((x) => ({
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
        setGames(norm);
      } catch (e: any) {
        flash(e?.message || "Failed to load games");
      }
    })();
  }, [season, week]);

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1];
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Scoreboard</h1>
        <div className="ml-auto flex items-center gap-3">
          <select
            className="border rounded px-2 py-1 bg-transparent"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select className="border rounded px-2 py-1 bg-transparent" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
            {Array.from({ length: 18 }).map((_, i) => {
              const wk = i + 1;
              return (
                <option key={wk} value={wk}>
                  Week {wk}
                </option>
              );
            })}
          </select>
        </div>
      </header>

      {msg ? <div className="mb-4 text-sm text-emerald-600">{msg}</div> : null}

      {/* SINGLE COLUMN to avoid clipping */}
      <div className="grid grid-cols-1 gap-6">
        {games.length === 0 ? (
          <div className="text-sm text-neutral-500">No games.</div>
        ) : (
          games.map((g) => <GameCard key={g.id} game={g} teamIndex={teamMap} />)
        )}
      </div>
    </main>
  );
}
