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

function fmtWhen(s?: string | null) {
  try {
    if (!s) return "";
    const d = new Date(s);
    return d.toLocaleString();
  } catch {
    return "";
  }
}

function statusColor(s: string | undefined) {
  const up = (s || "UPCOMING").toUpperCase();
  if (up === "FINAL") return "#0f172a";
  if (up === "LIVE") return "#b91c1c";
  return "#334155";
}

function StatusPill({ status }: { status?: string }) {
  const hex = statusColor(status);
  const label = (status || "UPCOMING").toUpperCase();
  return (
    <span
      className="rounded-full px-3 py-1 text-xs font-semibold"
      style={{ color: hex, border: `2px solid ${hex}`, background: "transparent" }}
    >
      {label}
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

  return (
    <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
      <header className="mb-3 flex items-center justify-between text-xs text-neutral-500">
        <span>
          {fmtWhen(game.game_utc)}
          {game.week ? ` • Week ${game.week}` : ""}
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
            displayText="full"
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
            displayText="full"
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
