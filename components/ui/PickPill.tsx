// components/ui/PickPill.tsx
"use client";

import TeamCard from "@/components/TeamCard";
import type { TeamShape } from "@/components/ui/TeamPill";

export type PickPillProps = {
  teamId?: string | null;
  teamMap?: Record<string, TeamShape>;
  className?: string;
  size?: "xs" | "sm" | "md";
  showLogo?: boolean;
};

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
}: PickPillProps) {
  const team = getTeam(teamId, teamMap);
  
  if (!team) {
    // Fallback for unknown teams
    return (
      <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm bg-neutral-100 dark:bg-neutral-800">
        <span className="font-semibold">{teamId || "—"}</span>
      </span>
    );
  }

  // Map size to padding
  const sizeClass = {
    xs: "p-1.5",
    sm: "p-2",
    md: "p-3",
  }[size];

  return (
    <div className={className}>
      <TeamCard
        team={{
          id: team.id || "",
          name: (team as any)?.name || "",
          short_name: (team as any)?.short_name || (team as any)?.name || "",
          abbreviation: (team as any)?.abbreviation || "",
          logo: (team as any)?.logo || "",
          color_primary: (team as any)?.color_primary || "#6b7280",
          color_secondary: (team as any)?.color_secondary,
          color_pref_light: (team as any)?.color_pref_light,
          color_pref_dark: (team as any)?.color_pref_dark,
        }}
        variant="solid"
        displayText="abbreviation"
        disabled
        className={sizeClass}
      />
    </div>
  );
}
