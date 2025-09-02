// app/api/wrinkles/[id]/games/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type ParamShape = { id: string };
async function unwrapParams(p: ParamShape | Promise<ParamShape>) {
  const maybe: any = p as any;
  return typeof maybe?.then === "function" ? await (p as Promise<ParamShape>) : (p as ParamShape);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { "X-Client-Info": "wrinkles-games-route" } },
});

function jErr(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: { message, details: details ?? null } }, { status });
}

/** Normalize a game shape with all common aliases the UI might expect. */
function normalizeGame(wg: any): any {
  // Prefer the joined game row; fall back to columns on wrinkle_games
  const g = wg?.game ?? {};
  const pick = <T>(...vals: T[]) => vals.find((v) => v !== undefined && v !== null);

  const id = pick(g.id, wg.game_id);
  const home = pick(g.home_team, wg.home_team, g.homeTeamId, wg.homeTeamId);
  const away = pick(g.away_team, wg.away_team, g.awayTeamId, wg.awayTeamId);
  const gameUtc = pick(g.game_utc, wg.game_utc, g.gameUtc, wg.gameUtc, g.start_utc, wg.start_utc);

  return {
    // core
    id,
    status: pick(g.status, wg.status),
    season: pick(g.season, wg.season),
    week: pick(g.week, wg.week),
    espn_id: pick(g.espn_id, wg.espn_id, g.espnId, wg.espnId),

    // time aliases
    game_utc: gameUtc ?? null,
    gameUtc: gameUtc ?? null,
    start_utc: gameUtc ?? null,
    startUtc: gameUtc ?? null,

    // team ids (multiple naming styles)
    home_team: home ?? null,
    away_team: away ?? null,
    home_team_id: home ?? null,
    away_team_id: away ?? null,
    homeTeamId: home ?? null,
    awayTeamId: away ?? null,

    // scores if present
    home_score: pick(g.home_score, wg.home_score, g.homeScore, wg.homeScore) ?? null,
    away_score: pick(g.away_score, wg.away_score, g.awayScore, wg.awayScore) ?? null,

    // spread if present
    spread: pick(g.spread, wg.spread) ?? null,
  };
}

export async function GET(
  _req: NextRequest,
  ctx: { params: ParamShape | Promise<ParamShape> }
) {
  try {
    const { id: wrinkleId } = await unwrapParams(ctx.params);

    // Join games so wg.game is populated
    const { data, error } = await db
      .from("wrinkle_games")
      .select("*, game:games(*)")
      .eq("wrinkle_id", wrinkleId);

    if (error) {
      return jErr("Failed to fetch wrinkle_games with joined game.", 500, error.message);
    }

    const combined = (data ?? []).map((wg: any) => ({
      wrinkle_game: wg,
      game: wg?.game ?? null,
      normalized: normalizeGame(wg),
    }));

    // Convenience singletons
    const first = combined[0] ?? null;
    const firstNorm = first?.normalized ?? null;

    // Return MANY shapes so the UI can latch onto *something*
    return NextResponse.json(
      {
        ok: true,

        // preferred combined rows
        data: combined,
        rows: combined,
        count: combined.length,

        // single row helpers
        row: first,
        wrinkle_game: first?.wrinkle_game ?? null,

        // direct game helpers
        game: first?.game ?? null,
        games: combined.map((x: any) => x.game).filter(Boolean),

        // normalized helpers (aliases for client convenience)
        linkedGame: firstNorm,       // <— best single object to consume
        linkedGames: combined.map((x: any) => x.normalized),
      },
      { status: 200 }
    );
  } catch (e: any) {
    return jErr("Unexpected server error.", 500, e?.message ?? String(e));
  }
}

