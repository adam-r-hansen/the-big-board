// components/WrinklePickButton.tsx
"use client";

import { useState } from "react";

type TeamColors = {
  color_primary?: string | null;
  color_secondary?: string | null;
};

type Props = {
  picked: boolean;
  disabled?: boolean;
  teamId: string;
  teams: Record<string, TeamColors>;
  onPick: () => Promise<void>;
  onUnpick: () => Promise<void>;
  children?: React.ReactNode; // button label (e.g., "DAL")
};

function readableOn(bg: string) {
  try {
    const hex = bg.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "#111" : "#fff";
  } catch {
    return "#fff";
  }
}

export default function WrinklePickButton({
  picked,
  disabled,
  teamId,
  teams,
  onPick,
  onUnpick,
  children,
}: Props) {
  const [loading, setLoading] = useState(false);

  const team = teams?.[teamId] || {};
  const primary = (team.color_primary || "#0f172a").toLowerCase(); // slate-900 fallback
  const secondary = (team.color_secondary || "#94a3b8").toLowerCase(); // slate-400 fallback
  const activeText = readableOn(primary);

  const style = picked
    ? { backgroundColor: primary, color: activeText, border: `2px solid ${secondary}` }
    : { backgroundColor: "transparent", color: primary, border: `2px solid ${primary}` };

  async function onClick() {
    if (loading || disabled) return;
    setLoading(true);
    try {
      if (picked) {
        await onUnpick();
      } else {
        await onPick();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={style}
      className="h-9 rounded-xl px-4 font-semibold transition-colors disabled:opacity-50"
    >
      {picked ? "Unpick" : children ?? "Pick"}
    </button>
  );
}

