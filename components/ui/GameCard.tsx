// components/ui/GameCard.tsx
"use client";

import type { CSSProperties, ReactNode } from "react";
import type { TeamShape } from "@/components/ui/TeamPill";
import { pickTeamColor, readableOn } from "@/components/ui/TeamPill";

/**
 * Minimal game shape expected by this card.
 * You can adapt your data mapping where you call <GameCard ... />.
 */
export type GameTeam = {
  id?: string;
  abbr?: string | null;
  name?: string | null;
  score?: number | null;
  logo?: string | null;
};

export type GameCardGame = {
  id: string;
  week: number;
  game_utc?: string | null; // ISO string
  status?: "UPCOMING" | "LIVE" | "FINAL" | string;
  home: GameTeam;
  away: GameTeam;
};

export type GameCardProps = {
  game: GameCardGame;
  /** Optional mapping for team colors by id (from /api/team-map) */
  teamIndex?: Record<string, TeamShape>;
  right?: ReactNode; // optional trailing item in header
};

function statusColor(s: string | undefined) {
  const up = (s || "UPCOMING").toUpperCase();
  if (up === "FINAL") return "#0f172a"; // slate-900
  if (up === "LIVE") return "#b91c1c"; // red-700
  return "#334155"; // slate-600 (upcoming)
}

function StatusPill({ status }: { status?: string }) {
  const hex = statusColor(status);
  const label = (status || "UPCOMING").toUpperCase();
  return (
    <span
      className="rounded-full px-3 py-1 text-xs font-semibold"
      style={{
        color: hex,
        border: `2px solid ${hex}`,
        background: "transparent",
      }}
    >
      {label}
    </span>
  );
}

function fmtWhen(s?: string | null) {
  try {
    if (!s) return "";
    const d = new Date(s);
    return d.toLocaleString();
  } catch {
    return "";
  }
}

function TeamLogo({ logo, alt }: { logo?: string | null; alt?: string | null }) {
  return (
    <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full border border-black/10 bg-white overflow-hidden">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={alt || ""} className="w-8 h-8 object-contain" />
      ) : (
        <span className="w-6 h-6 rounded-full bg-black/10" />
      )}
    </span>
  );
}

export default function GameCard({ game, teamIndex, right }: GameCardProps) {
  const s = (game.status || "UPCOMING").toUpperCase();

  // Look up optional TeamShape to derive mono colors
  const homeTeam: TeamShape | undefined = game.home.id
    ? teamIndex?.[game.home.id]
    : undefined;
  const awayTeam: TeamShape | undefined = game.away.id
    ? teamIndex?.[game.away.id]
    : undefined;

  const homeBg = pickTeamColor(homeTeam, "light");
  const awayBg = pickTeamColor(awayTeam, "light");

  const homeText = readableOn(homeBg);
  const awayText = readableOn(awayBg);

  const homeScore = typeof game.home.score === "number" ? game.home.score : null;
  const awayScore = typeof game.away.score === "number" ? game.away.score : null;

  return (
    <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
      <header className="mb-3 flex items-center justify-between text-xs text-neutral-500">
        <span>
          {fmtWhen(game.game_utc)}
          {game.week ? ` • Week ${game.week}` : null}
        </span>
        <div className="flex items-center gap-2">
          {right}
          <StatusPill status={s} />
        </div>
      </header>

      {/* Single-column layout, each side is a pill with logo + name + score */}
      <div className="grid gap-3">
        {/* HOME */}
        <div className="flex items-center min-w-0">
          <TeamLogo
            logo={game.home.logo || undefined}
            alt={game.home.name || game.home.abbr || "Home"}
          />
          <div
            className="flex items-center justify-between gap-3 rounded-full px-4 py-3 min-w-0 flex-1 ml-3"
            style={{ background: homeBg, color: homeText } as CSSProperties}
          >
            <span className="truncate font-semibold">
              {game.home.name || game.home.abbr}
            </span>
            {homeScore != null && (
              <span className="text-lg font-bold">{homeScore}</span>
            )}
          </div>
        </div>

        {/* AWAY */}
        <div className="flex items-center min-w-0">
          <TeamLogo
            logo={game.away.logo || undefined}
            alt={game.away.name || game.away.abbr || "Away"}
          />
          <div
            className="flex items-center justify-between gap-3 rounded-full px-4 py-3 min-w-0 flex-1 ml-3"
            style={{ background: awayBg, color: awayText } as CSSProperties}
          >
            <span className="truncate font-semibold">
              {game.away.name || game.away.abbr}
            </span>
            {awayScore != null && (
              <span className="text-lg font-bold">{awayScore}</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
