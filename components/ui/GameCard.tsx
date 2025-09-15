// components/ui/GameCard.tsx
"use client";

import type { CSSProperties, ReactNode } from "react";
import type { TeamShape } from "@/components/ui/TeamPill"; // type-only import

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
  game_utc?: string | null; // ISO
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

/** Pick a solid mono color from TeamShape */
function pickMonoColor(team: Partial<TeamShape> | undefined, mode: "light" | "dark") {
  if (!team) return mode === "light" ? "#e5e7eb" : "#111827";
  const pref =
    (mode === "light"
      ? (team as any).ui_light_color_key
      : (team as any).ui_dark_color_key) as string | undefined;

  const val = (key?: string) => {
    const v = key ? (team as any)[key] : undefined;
    return typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : null;
  };

  return (
    val(pref) ||
    val(mode === "light" ? "color_primary" : "color_secondary") ||
    val("color_tertiary") ||
    val("color_quaternary") ||
    (mode === "light" ? "#e5e7eb" : "#111827")
  );
}

/** Choose black/white text on a hex bg */
function readableOn(bg: string) {
  try {
    const hex = bg.replace("#", "");
    const v = hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex;
    const r = parseInt(v.slice(0, 2), 16) / 255;
    const g = parseInt(v.slice(2, 4), 16) / 255;
    const b = parseInt(v.slice(4, 6), 16) / 255;
    const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const L = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
    return L > 0.5 ? "#111827" : "#ffffff";
  } catch {
    return "#111827";
  }
}

function statusColor(s: string | undefined) {
  const up = (s || "UPCOMING").toUpperCase();
  if (up === "FINAL") return "#0f172a"; // slate-900
  if (up === "LIVE") return "#b91c1c"; // red-700
  return "#334155"; // slate-600
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

/* a tiny inline logo circle */
function LogoDot({ src, alt }: { src?: string | null; alt?: string | null }) {
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/95 border border-black/10 overflow-hidden shrink-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt || ""} className="w-6 h-6 object-contain" />
      ) : (
        <span className="w-4 h-4 rounded-full bg-black/10" />
      )}
    </span>
  );
}

/* ---------------- component ---------------- */

export default function GameCard({ game, teamIndex, right }: GameCardProps) {
  const s = (game.status || "UPCOMING").toUpperCase();

  const homeShape: Partial<TeamShape> | undefined = game.home.id
    ? teamIndex?.[game.home.id]
    : undefined;
  const awayShape: Partial<TeamShape> | undefined = game.away.id
    ? teamIndex?.[game.away.id]
    : undefined;

  const homeBg = pickMonoColor(homeShape, "light");
  const awayBg = pickMonoColor(awayShape, "light");
  const homeText = readableOn(homeBg);
  const awayText = readableOn(awayBg);

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

      {/* one column; each row is a filled mono-color pill with logo + name + score inside */}
      <div className="grid gap-3">
        {/* HOME */}
        <div
          className="flex items-center gap-3 rounded-full px-4 py-3 min-w-0"
          style={{ background: homeBg, color: homeText } as CSSProperties}
        >
          <LogoDot src={game.home.logo} alt={game.home.name || game.home.abbr || "Home"} />
          <span className="truncate font-semibold text-base md:text-lg">
            {game.home.name || game.home.abbr}
          </span>
          <span className="ml-auto inline-flex items-center justify-center rounded-full px-3 py-1 text-base md:text-lg font-extrabold"
            style={{ background: "transparent", color: homeText }}>
            {homeScore != null ? homeScore : "—"}
          </span>
        </div>

        {/* AWAY */}
        <div
          className="flex items-center gap-3 rounded-full px-4 py-3 min-w-0"
          style={{ background: awayBg, color: awayText } as CSSProperties}
        >
          <LogoDot src={game.away.logo} alt={game.away.name || game.away.abbr || "Away"} />
          <span className="truncate font-semibold text-base md:text-lg">
            {game.away.name || game.away.abbr}
          </span>
          <span className="ml-auto inline-flex items-center justify-center rounded-full px-3 py-1 text-base md:text-lg font-extrabold"
            style={{ background: "transparent", color: awayText }}>
            {awayScore != null ? awayScore : "—"}
          </span>
        </div>
      </div>
    </article>
  );
}
