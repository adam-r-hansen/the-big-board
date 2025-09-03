// components/TeamColorButton.tsx
"use client";

type TeamColors = {
  color_primary?: string | null;
  color_secondary?: string | null;
};

type Props = {
  teamId: string;
  label: string;
  picked?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  teams: Record<string, TeamColors>;
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

export default function TeamColorButton({
  teamId,
  label,
  picked,
  disabled,
  onClick,
  teams,
}: Props) {
  const t = teams?.[teamId] || {};
  const primary = (t.color_primary || "#0f172a").toLowerCase();   // slate-900 fallback
  const secondary = (t.color_secondary || "#94a3b8").toLowerCase(); // slate-400 fallback
  const activeText = readableOn(primary);

  const style = picked
    ? { backgroundColor: primary, color: activeText, border: `2px solid ${secondary}` }
    : { backgroundColor: "transparent", color: primary, border: `2px solid ${primary}` };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={style}
      className="h-10 w-full rounded-xl px-4 text-base font-semibold transition-colors disabled:opacity-50"
    >
      {label}
    </button>
  );
}

