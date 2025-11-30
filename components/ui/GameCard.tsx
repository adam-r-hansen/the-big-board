// components/ui/GameCard.tsx
"use client";

import type { ReactNode } from "react";
import TeamCard from "@/components/TeamCard";
import type { TeamShape } from "@/components/ui/TeamPill";

export type GameTeam = {
  id?: string;
  abbr?: string | null;
  abbreviation?: string | null;
  name?: string | null;
  score?: number | null;
  logo?: string | null;
};

export type GameCardGame = {
  id: string;
  week: number;
  game_utc?: string | null;
  status?: "UPCOMING" | "LIVE" | "FINAL" | string;
  home: GameTeam;
  away: GameTeam;
};

export type GameCardProps = {
  game: GameCardGame;
  teamIndex?: Record<string, TeamShape>;
  right?: ReactNode;
};

/* ---------------- helpers ---------------- */

function formatGameTime(gameUtc?: string | null): { date: string; time: string } {
  try {
    if (!gameUtc) return { date: "", time: "" };
    const d = new Date(gameUtc);
    
    // Format date: "Thu, Nov 28"
    const date = d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    
    // Format time: "7:00 AM PST"
    const time = d.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
    
    return { date, time };
  } catch {
    return { date: gameUtc || "", time: "" };
  }
}

function StatusPill({ status }: { status?: string }) {
  const s = (status || 'UPCOMING').toUpperCase();
  
  let pillClass = 'status-pill-upcoming';
  let displayText = 'Upcoming';
  let showDot = false;

  if (s === 'LIVE') {
    pillClass = 'status-pill-live';
    displayText = 'Live';
    showDot = true;
  } else if (s === 'FINAL') {
    pillClass = 'status-pill-final';
    displayText = 'Final';
  } else if (s === 'LOCKED') {
    pillClass = 'status-pill-locked';
    displayText = 'Locked';
  }

  return (
    <span className={`status-pill ${pillClass}`}>
      {showDot && <span className="status-pill-dot">●</span>}
      {displayText}
    </span>
  );
}

/** Resolve team data using teamIndex by id or abbr */
function resolveTeam(t: GameTeam, teamIndex?: Record<string, TeamShape>) {
  const idKey = t.id && teamIndex ? teamIndex[t.id] : undefined;
  const abbr = (t.abbr || t.abbreviation || "")?.toString().toUpperCase();
  const abbrKey = abbr && teamIndex ? teamIndex[abbr] : undefined;

  const shape = idKey || abbrKey;
  
  return {
    id: t.id || shape?.id || "",
    name: (shape as any)?.name || t.name || abbr || "—",
    short_name: (shape as any)?.short_name || (shape as any)?.name || t.name || abbr || "—",
    abbreviation: (shape as any)?.abbreviation || abbr || "—",
    logo: (shape as any)?.logo || t.logo || "",
    color_primary: (shape as any)?.color_primary || "#6b7280",
    color_secondary: (shape as any)?.color_secondary,
    color_pref_light: (shape as any)?.color_pref_light,
    color_pref_dark: (shape as any)?.color_pref_dark,
  };
}

/* ---------------- component ---------------- */

export default function GameCard({ game, teamIndex, right }: GameCardProps) {
  const s = (game.status || "UPCOMING").toUpperCase();

  const homeTeam = resolveTeam(game.home, teamIndex);
  const awayTeam = resolveTeam(game.away, teamIndex);

  const homeScore = typeof game.home.score === "number" ? game.home.score : null;
  const awayScore = typeof game.away.score === "number" ? game.away.score : null;

  const { date, time } = formatGameTime(game.game_utc);

  return (
    <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            {date}
          </div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400">
            {time}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {right}
          <StatusPill status={s} />
        </div>
      </header>

      <div className="grid gap-3">
        {/* HOME */}
        <div className="relative">
          <TeamCard
            team={homeTeam}
            variant="solid"
            displayText="short"
            disabled
          />
          {homeScore !== null && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <span className="inline-flex items-center justify-center rounded-full bg-white/20 px-3 py-1 text-lg font-extrabold text-white">
                {homeScore}
              </span>
            </div>
          )}
        </div>

        {/* AWAY */}
        <div className="relative">
          <TeamCard
            team={awayTeam}
            variant="solid"
            displayText="short"
            disabled
          />
          {awayScore !== null && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <span className="inline-flex items-center justify-center rounded-full bg-white/20 px-3 py-1 text-lg font-extrabold text-white">
                {awayScore}
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
