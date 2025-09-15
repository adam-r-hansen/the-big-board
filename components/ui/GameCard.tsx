// components/ui/GameCard.tsx
"use client";

import Image from "next/image";
import type { ReactNode, CSSProperties } from "react";
import type { TeamShape } from "@/components/ui/TeamPill";
import { pickTeamColor, readableOn } from "@/components/ui/TeamPill";

/** Minimal game shape consumed by this card */
export type GameCardGame = {
  id: string;
  week: number;
  game_utc: string; // ISO
  status?: "UPCOMING" | "LIVE" | "FINAL";
  home: { id?: string; name?: string | null; abbr?: string | null; score?: number | null; logo?: string | null };
  away: { id?: string; name?: string | null; abbr?: string | null; score?: number | null; logo?: string | null };
};

type Props = {
  game: GameCardGame;
  teamIndex?: Record<string, TeamShape>;
  right?: ReactNode;
};

function statusColorHex(status?: string) {
  const s = (status || "UPCOMING").toUpperCase();
  if (s === "FINAL") return "#111827";      // neutral-900
  if (s === "LIVE") return "#dc2626";       // red-600
  return "#6b7280";                          // neutral-500
}

function TeamLogo({ logo, alt }: { logo?: string | null; alt: string }) {
  return (
    <div className="mr-3 shrink-0 grid place-items-center rounded-full border border-black/10 bg-white dark:bg-neutral-900 w-10 h-10">
      {logo ? (
        <Image
          src={logo}
          alt={alt}
          width={24}
          height={24}
          className="object-contain"
          unoptimized
        />
      ) : (
        <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
          {alt?.slice(0, 1) || "•"}
        </span>
      )}
    </div>
  );
}

export default function GameCard({ game, teamIndex, right }: Props) {
  const statusHex = statusColorHex(game.status);

  const homeTeam: TeamShape | undefined = game.home.id ? teamIndex?.[game.home.id] : undefined;
  const awayTeam: TeamShape | undefined = game.away.id ? teamIndex?.[game.away.id] : undefined;

  const homeBg = pickTeamColor("light", homeTeam); 
  const awayBg = pickTeamColor("light", awayTeam);

  const homeText = readableOn(homeBg);
  const awayText = readableOn(awayBg);

  const when = game.game_utc ? new Date(game.game_utc).toLocaleString() : "";

  return (
    <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5">
      {/* Top row */}
      <div className="mb-3 flex items-center gap-3">
        <div className="text-sm text-neutral-600 dark:text-neutral-400 truncate">
          {when} • Week {game.week}
        </div>
        <div className="ml-auto">
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
            style={
              {
                border: `2px solid ${statusHex}`,
                color: statusHex,
                background: "transparent",
              } as CSSProperties
            }
          >
            {(game.status || "UPCOMING").toUpperCase()}
          </span>
        </div>
        {right}
      </div>

      {/* Teams — single column safe layout */}
      <div className="flex flex-col gap-3">
        {/* HOME */}
        <div className="flex items-center min-w-0">
          <TeamLogo logo={homeTeam?.logo || game.home.logo} alt={game.home.name || game.home.abbr || "Home"} />
          <div
            className="flex items-center justify-between gap-3 rounded-full px-4 py-3 min-w-0 flex-1"
            style={{ background: homeBg, color: homeText } as CSSProperties}
          >
            <div className="truncate text-base md:text-lg font-semibold">
              {game.home.name || homeTeam?.name || game.home.abbr || "Home"}
            </div>
            <div className="shrink-0 text-lg md:text-xl font-extrabold tabular-nums">
              {typeof game.home.score === "number" ? game.home.score : (game.status === "UPCOMING" ? "—" : "0")}
            </div>
          </div>
        </div>

        {/* AWAY */}
        <div className="flex items-center min-w-0">
          <TeamLogo logo={awayTeam?.logo || game.away.logo} alt={game.away.name || game.away.abbr || "Away"} />
          <div
            className="flex items-center justify-between gap-3 rounded-full px-4 py-3 min-w-0 flex-1"
            style={{ background: awayBg, color: awayText } as CSSProperties}
          >
            <div className="truncate text-base md:text-lg font-semibold">
              {game.away.name || awayTeam?.name || game.away.abbr || "Away"}
            </div>
            <div className="shrink-0 text-lg md:text-xl font-extrabold tabular-nums">
              {typeof game.away.score === "number" ? game.away.score : (game.status === "UPCOMING" ? "—" : "0")}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
