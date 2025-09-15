// components/ui/GameCard.tsx
import Image from "next/image";
import type { ReactNode, CSSProperties } from "react";
import type { TeamShape } from "@/components/ui/TeamPill";
import { pickTeamColor, readableTextOn } from "@/components/ui/TeamPill";

/**
 * Minimal game shape expected by this card.
 * Adapt your fetch/normalizer to fill these fields.
 */
export type GameCardGame = {
  id: string;
  week: number;
  game_utc?: string | null; // ISO string
  status?: "UPCOMING" | "LIVE" | "FINAL" | "DELAYED" | string;
  home: { id?: string; abbr?: string | null; score?: number | null; logo?: string | null };
  away: { id?: string; abbr?: string | null; score?: number | null; logo?: string | null };
};

/**
 * Supply team metadata so the pill can render name, colors, and logo.
 * Pass either `teamIndex` (id -> TeamShape) or a resolver function.
 */
export type GameCardProps = {
  game: GameCardGame;
  teamIndex?: Record<string, TeamShape>;
  resolveTeam?: (id?: string, abbr?: string | null) => TeamShape | undefined;
  className?: string;
  onClick?: () => void;
};

/* ———————————————————————————————————————————————————————— */
/* Helpers                                                      */
/* ———————————————————————————————————————————————————————— */

function resolveTeam(
  t: { id?: string; abbr?: string | null; logo?: string | null },
  teamIndex?: Record<string, TeamShape>,
  resolver?: (id?: string, abbr?: string | null) => TeamShape | undefined
): TeamShape | undefined {
  if (resolver) return resolver(t.id, t.abbr ?? undefined);
  if (!teamIndex) return undefined;
  if (t.id && teamIndex[t.id]) return teamIndex[t.id];
  if (t.abbr) {
    const hit = Object.values(teamIndex).find(
      (x) => (x.abbreviation || "").toUpperCase() === (t.abbr || "").toUpperCase()
    );
    if (hit) return hit;
  }
  return undefined;
}

function statusColor(status?: string) {
  const s = (status || "UPCOMING").toUpperCase();
  if (s === "LIVE") return "#059669";        // emerald-600
  if (s === "FINAL") return "#334155";       // slate-700
  if (s === "DELAYED") return "#b45309";     // amber-700
  return "#6b7280";                          // neutral-500
}

function niceKickoff(dt?: string | null) {
  try {
    if (!dt) return "";
    return new Date(dt).toLocaleString();
  } catch {
    return "";
  }
}

function isWinner(game: GameCardGame, side: "home" | "away") {
  const hs = game.home.score;
  const as = game.away.score;
  if (game.status?.toUpperCase() !== "FINAL") return false;
  if (typeof hs !== "number" || typeof as !== "number") return false;
  if (hs === as) return false;
  return side === "home" ? hs > as : as > hs;
}

/* ———————————————————————————————————————————————————————— */
/* UI bits                                                      */
/* ———————————————————————————————————————————————————————— */

function StatusPill({ status }: { status?: string }) {
  const color = statusColor(status);
  const style: CSSProperties = { color, borderColor: color };
  const label = (status || "UPCOMING").toUpperCase();
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-semibold tracking-wide uppercase"
      style={style}
    >
      {label}
    </span>
  );
}

function TeamLogo({
  team,
  size = 22,
}: {
  team?: TeamShape;
  size?: number;
}) {
  const src = team?.logo || team?.logo_dark || "";
  const alt = team?.name || team?.abbreviation || "team";
  if (src) {
    return (
      <span className="flex-shrink-0 rounded-full overflow-hidden" style={{ width: size, height: size }}>
        {/* If remote domains aren't whitelisted, Next will fall back gracefully to the text avatar. */}
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="object-contain"
        />
      </span>
    );
  }
  // Text avatar fallback
  return (
    <span
      className="flex-shrink-0 rounded-full grid place-items-center text-[10px] font-bold border"
      style={{
        width: size,
        height: size,
        background: "#ffffff",
        color: "#111827",
        borderColor: "#e5e7eb",
      }}
      aria-hidden
    >
      {(team?.abbreviation || "?").slice(0, 3).toUpperCase()}
    </span>
  );
}

function TeamPillInCard({
  team,
  score,
  emphasis = false,
}: {
  team?: TeamShape;
  score?: number | null;
  emphasis?: boolean; // true when this side is the winner (FINAL)
}) {
  const bg = pickTeamColor(team, "light");
  const fg = readableTextOn(bg);
  const border = emphasis ? "2px" : "1px";
  const name = team?.name || team?.abbreviation || "—";

  return (
    <div
      className="w-full rounded-full flex items-center gap-2 px-3 py-2"
      style={{
        background: bg,
        color: fg,
        border: `${border} solid ${bg}`,
        boxShadow: emphasis ? "0 0 0 2px rgba(0,0,0,0.06) inset" : undefined,
      }}
    >
      <TeamLogo team={team} />
      <span className="truncate font-semibold">{name}</span>
      <span className="ml-auto inline-flex items-center justify-center rounded-full border px-2 py-[2px] text-xs font-bold"
        style={{
          borderColor: fg,
          color: fg,
        }}
      >
        {typeof score === "number" ? score : "—"}
      </span>
    </div>
  );
}

/* ———————————————————————————————————————————————————————— */
/* GameCard                                                     */
/* ———————————————————————————————————————————————————————— */

export default function GameCard({
  game,
  teamIndex,
  resolveTeam,
  className = "",
  onClick,
}: GameCardProps) {
  const home = resolveTeam(game.home, teamIndex, resolveTeam);
  const away = resolveTeam(game.away, teamIndex, resolveTeam);

  const kickoff = niceKickoff(game.game_utc);
  const s = (game.status || "UPCOMING").toUpperCase() as GameCardGame["status"];

  return (
    <article
      className={[
        "rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5",
        onClick ? "cursor-pointer hover:bg-neutral-50/60 dark:hover:bg-neutral-800/50" : "",
        className,
      ].join(" ")}
      onClick={onClick}
    >
      {/* Header: kickoff + week + status */}
      <div className="mb-3 flex items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400">
        <span className="truncate">{kickoff}</span>
        <span>•</span>
        <span>Week {game.week}</span>
        <div className="ml-auto">
          <StatusPill status={s} />
        </div>
      </div>

      {/* Body: two team pills with a dash */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <TeamPillInCard
            team={home}
            score={game.home.score ?? null}
            emphasis={isWinner(game, "home")}
          />
        </div>

        <div className="text-neutral-400 select-none">—</div>

        <div className="flex-1">
          <TeamPillInCard
            team={away}
            score={game.away.score ?? null}
            emphasis={isWinner(game, "away")}
          />
        </div>
      </div>
    </article>
  );
}
