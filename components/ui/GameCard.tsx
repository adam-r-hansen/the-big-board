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

function formatGameTime(gameUtc?: string | null): string {
  try {
    if (!gameUtc) return "";
    const d = new Date(gameUtc);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const day = days[d.getDay()];
    const month = months[d.getMonth()];
    const date = d.getDate();
    
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const mins = minutes.toString().padStart(2, '0');
    
    return `${day}, ${month} ${date} • ${hours}:${mins} ${ampm} ET`;
  } catch {
    return gameUtc || "";
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

  const kickoff = formatGameTime(game.game_utc);

  return (
    <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
      <header className="mb-3 flex items-center justify-between">
        <span className="game-time">
          {kickoff && (
            <>
              <span className="game-time-day">{kickoff.split(',')[0]}</span>
              {kickoff.substring(kickoff.indexOf(','))}
            </>
          )}
        </span>
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
            displayText="responsive"
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
            displayText="responsive"
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
