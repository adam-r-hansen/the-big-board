// app/scoreboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import GameCard, { type GameCardGame } from "@/components/ui/GameCard";
import type { TeamShape } from "@/components/ui/TeamPill";

type TeamMap = Record<string, TeamShape>;

function tuesdayToMondayWeekIndex(d: Date) {
  // Return NFL-style "week" number within the season window based on Tue→Mon
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
  const [teamMap, setTeamMap] = useState<TeamMap>({});
  const [games, setGames] = useState<GameCardGame[]>([]);
  const [season, setSeason] = useState<number>(new Date().getFullYear());
  const [week, setWeek] = useState<number>(tuesdayToMondayWeekIndex(new Date()));

  useEffect(() => {
    // Fetch team map
    (async () => {
      try {
        const res = await fetch("/api/team-map", { cache: "no-store" });
        const data = await res.json();
        setTeamMap(data?.teams || {});
      } catch (err) {
        console.error("Failed to load team map", err);
      }
    })();
  }, []);

  useEffect(() => {
    // Fetch games for selected season/week
    (async () => {
      try {
        const res = await fetch(`/api/games-for-week?season=${season}&week=${week}`, {
          cache: "no-store",
        });
        const data = await res.json();
        const rawGames = data?.games || [];

        // Normalize to GameCardGame format
        const normalized: GameCardGame[] = rawGames.map((g: any) => ({
          id: g.id,
          week: g.week ?? week,
          // Convert game_utc to user's local timezone with better formatting
          kickoff: g.game_utc
            ? new Date(g.game_utc).toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short',
              })
            : "",
          home: g.home?.abbreviation ?? g.home_abbr ?? "?",
          homeId: g.home?.id ?? g.home_team ?? "",
          homeScore: g.home_score ?? null,
          away: g.away?.abbreviation ?? g.away_abbr ?? "?",
          awayId: g.away?.id ?? g.away_team ?? "",
          awayScore: g.away_score ?? null,
          status: (g.status ?? "UPCOMING").toUpperCase(),
        }));

        setGames(normalized);
      } catch (err) {
        console.error("Failed to load games", err);
      }
    })();
  }, [season, week]);

  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => {
      // Parse kickoff strings back to dates for sorting
      const dateA = a.kickoff ? new Date(a.kickoff) : new Date(0);
      const dateB = b.kickoff ? new Date(b.kickoff) : new Date(0);
      return dateA.getTime() - dateB.getTime();
    });
  }, [games]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      {/* Header with season/week selectors */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Scoreboard</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            Season
            <select
              value={season}
              onChange={(e) => setSeason(Number(e.target.value))}
              className="rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1"
            >
              {[2023, 2024, 2025].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            Week
            <select
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              className="rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1"
            >
              {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {/* Games */}
      <section className="space-y-4">
        {sortedGames.length === 0 && (
          <p className="text-center text-neutral-500">No games found for this week.</p>
        )}
        {sortedGames.map((game) => (
          <GameCard key={game.id} game={game} teams={teamMap} />
        ))}
      </section>
    </main>
  );
}
