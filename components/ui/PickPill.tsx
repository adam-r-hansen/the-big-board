// components/ui/PickPill.tsx
"use client";

import type { CSSProperties } from "react";
import type { TeamShape } from "@/components/ui/TeamPill";

/**
 * Small, resilient team chip used for picks.
 * Looks up by id OR abbreviation (case-insensitive).
 * Falls back to neutral styling if no team is found.
 */
export type PickPillProps = {
  teamId?: string | null;
  teamMap?: Record<string, TeamShape>;
  className?: string;
  size?: "xs" | "sm" | "md";
  showLogo?: boolean;
};

function readableOn(hex?: string | null) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return "#111827";
  try {
    const v = hex.slice(1);
    const h = v.length === 3 ? v.split("").map(c => c + c).join("") : v;
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const L = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
    return L > 0.55 ? "#111827" : "#ffffff";
  } catch {
    return "#111827";
  }
}

function getTeam(teamId?: string | null, teamMap?: Record<string, TeamShape>): TeamShape | undefined {
  if (!teamId || !teamMap) return undefined;
  const direct = teamMap[teamId];
  if (direct) return direct;
  const up = teamId.toUpperCase();
  return teamMap[up] || teamMap[up.replace(/\s+/g, "")];
}

export default function PickPill({
  teamId,
  teamMap,
  className,
  size = "sm",
  showLogo = true,
}: PickPillProps) {
  const team = getTeam(teamId, teamMap);
  const label =
    (team as any)?.abbreviation ||
    (team as any)?.abbr ||
    (team as any)?.name ||
    (typeof teamId === "string" ? teamId.toUpperCase() : "—");

  const bg =
    ((team as any)?.ui_light_color_key as string) ||
    ((team as any)?.color_primary as string) ||
    "#f3f4f6"; // neutral-100
  const fg = readableOn(bg);

  const sizes = {
    xs: { padX: "px-2", padY: "py-0.5", text: "text-[11px]", logo: "w-4 h-4" },
    sm: { padX: "px-3", padY: "py-1", text: "text-sm", logo: "w-5 h-5" },
    md: { padX: "px-3.5", padY: "py-1.5", text: "text-base", logo: "w-6 h-6" },
  }[size];

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border border-black/10",
        sizes.padX,
        sizes.padY,
        sizes.text,
        className || "",
      ].join(" ")}
      style={{ background: bg, color: fg } as CSSProperties}
      title={typeof label === "string" ? label : undefined}
    >
      {showLogo ? (
        <span
          className={`inline-flex items-center justify-center rounded-full bg-white/95 border border-black/10 ${sizes.logo}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {((team as any)?.logo as string) ? (
            <img src={(team as any).logo as string} alt={String(label)} className="object-contain w-full h-full" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-black/10" />
          )}
        </span>
      ) : null}
      <span className="font-semibold truncate max-w-[8ch]">{String(label)}</span>
    </span>
  );
}
