// components/ui/GameCard.tsx
'use client'

import type { ReactNode, CSSProperties } from "react";
import type { TeamShape } from "@/components/ui/TeamPill";
import { pickTeamColor, readableOn } from "@/components/ui/TeamPill";

/** Minimal game shape expected by this card. */
export type GameCardTeam = TeamShape & {
  logo?: string | null;
};

export type GameCardData = {
  id: string;
  week: number;
  game_utc: string; // ISO
  status?: "UPCOMING" | "LIVE" | "FINAL";
  home: { id?: string; name?: string | null; abbr?: string | null; score?: number | null; logo?: string | null } & Partial<GameCardTeam>;
  away: { id?: string; name?: string | null; abbr?: string | null; score?: number | null; logo?: string | null } & Partial<GameCardTeam>;
};

type Props = {
  game: GameCardData;
  className?: string;
  right?: ReactNode; // extra actions, if any
};

function pillStyle(bg: string): CSSProperties {
  return {
    background: bg,
    color: readableOn(bg),
    borderColor: bg,
  };
}

function statusColor(status?: string) {
  const s = (status || '').toUpperCase();
  if (s === 'FINAL') return '#111827';     // neutral-900
  if (s === 'LIVE')  return '#dc2626';     // red-600
  return '#6b7280';                        // gray-500
}

export default function GameCard({ game, className = "", right }: Props) {
  const s = (game.status || 'UPCOMING').toUpperCase() as "UPCOMING" | "LIVE" | "FINAL";
  const when = game.game_utc ? new Date(game.game_utc).toLocaleString() : '';

  // ✅ pickTeamColor now expects (mode, team)
  const homeBg = pickTeamColor('light', game.home as TeamShape);
  const awayBg = pickTeamColor('light', game.away as TeamShape);

  const statusHex = statusColor(s);

  const homeScore =
    typeof game.home.score === 'number' ? game.home.score : (s === 'FINAL' || s === 'LIVE' ? 0 : null);
  const awayScore =
    typeof game.away.score === 'number' ? game.away.score : (s === 'FINAL' || s === 'LIVE' ? 0 : null);

  return (
    <article
      className={[
        "rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5",
        className,
      ].join(" ")}
    >
      <header className="mb-3 flex items-center justify-between text-xs text-neutral-500">
        <span>{when} • Week {game.week}</span>

        {/* Transparent status pill with colored border/text */}
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 border text-[10px] font-semibold tracking-wide uppercase"
          style={{ borderColor: statusHex, color: statusHex, background: 'transparent' }}
        >
          {s}
        </span>
      </header>

      <div className="flex items-center gap-3">
        {/* Home */}
        <div className="flex-1">
          <div
            className="w-full rounded-full border px-4 py-3 flex items-center gap-3"
            style={pillStyle(homeBg)}
            title={game.home.name || game.home.abbr || ""}
          >
            {game.home.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={game.home.logo}
                alt={game.home.abbr || "logo"}
                className="h-6 w-6 shrink-0 rounded-sm bg-white/80 p-0.5"
              />
            ) : null}
            <div className="truncate font-semibold">
              <span className="hidden sm:inline">{game.home.name || game.home.abbr}</span>
              <span className="sm:hidden">{game.home.abbr || game.home.name}</span>
            </div>
            <div className="ml-auto tabular-nums font-semibold">
              {homeScore ?? "—"}
            </div>
          </div>
        </div>

        <div className="text-neutral-400">—</div>

        {/* Away */}
        <div className="flex-1">
          <div
            className="w-full rounded-full border px-4 py-3 flex items-center gap-3"
            style={pillStyle(awayBg)}
            title={game.away.name || game.away.abbr || ""}
          >
            {game.away.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={game.away.logo}
                alt={game.away.abbr || "logo"}
                className="h-6 w-6 shrink-0 rounded-sm bg-white/80 p-0.5"
              />
            ) : null}
            <div className="truncate font-semibold">
              <span className="hidden sm:inline">{game.away.name || game.away.abbr}</span>
              <span className="sm:hidden">{game.away.abbr || game.away.name}</span>
            </div>
            <div className="ml-auto tabular-nums font-semibold">
              {awayScore ?? "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Optional footer row for extras */}
      {right ? <div className="mt-3">{right}</div> : null}
    </article>
  );
}
