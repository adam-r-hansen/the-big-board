const res = await fetch(`/api/wrinkles/${wrinkleId}/games`, { cache: "no-store" });
const payload = await res.json();

// Prefer data[]; fall back to rows[]
const items = Array.isArray(payload?.data) ? payload.data : payload?.rows ?? [];
// Each item: { wrinkle_game, game }

