// app/api/wrinkles/active/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { "X-Client-Info": "wrinkles-active-route" } },
});

function jErr(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: { message, details: details ?? null } }, { status });
}

function normalizeGame(wg: any): any {
  const g = wg?.game ?? {};
  const pick = <T>(...vals: T[]) => vals.find((v) => v !== undefined && v !== null);

  const id = pick(g.id, wg.game_id);
  const home = pick(g.home_team, wg.home_team, g.homeTeamId, wg.homeTeamId);
  const away = pick(g.away_team, wg.away_team, g.awayTeamId, wg.awayTeamId);
  const when = pick(g.game_utc, wg.game_utc, g.gameUtc, wg.gameUtc, g.start_utc, wg.start_utc);

  return {
    id,
    status: pick(g.status, wg.status) ?? null,
    season: pick(g.season, wg.season) ?? null,
    week: pick(g.week, wg.week) ?? null,
    espn_id: pick(g.espn_id, wg.espn_id, g.espnId, wg.espnId) ?? null,

    game_utc: when ?? null,
    gameUtc: when ?? null,
    start_utc: when ?? null,
    startUtc: when ?? null,

    home_team: home ?? null,
    away_team: away ?? null,
    home_team_id: home ?? null,
    away_team_id: away ?? null,
    homeTeamId: home ?? null,
    awayTeamId: away ?? null,

    home_score: pick(g.home_score, wg.home_score, g.homeScore, wg.homeScore) ?? null,
    away_score: pick(g.away_score, wg.away_score, g.awayScore, wg.awayScore) ?? null,
    spread: pick(g.spread, wg.spread) ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const seasonParam = (searchParams.get("season") ?? "").trim();
    const weekParam   = (searchParams.get("week") ?? "").trim();
    const leagueId    = (searchParams.get("leagueId") ?? "").trim(); // may be ""

    if (!seasonParam || !weekParam) {
      return jErr("Query params 'season' and 'week' are required.", 400, {
        season: seasonParam, week: weekParam,
      });
    }

    // 1) find wrinkle: league-specific → global
    let wrinkle: any = null;

    if (leagueId) {
      const { data, error } = await db
        .from("wrinkles")
        .select("*")
        .eq("season", seasonParam)
        .eq("week", weekParam)
        .eq("league_id", leagueId)
        .limit(1)
        .maybeSingle();
      if (error) return jErr("Failed to fetch league-specific wrinkle.", 500, error.message);
      wrinkle = data ?? null;
    }

    if (!wrinkle) {
      const { data, error } = await db
        .from("wrinkles")
        .select("*")
        .eq("season", seasonParam)
        .eq("week", weekParam)
        .is("league_id", null)
        .limit(1)
        .maybeSingle();
      if (error) return jErr("Failed to fetch global wrinkle.", 500, error.message);
      wrinkle = data ?? null;
    }

    if (!wrinkle) {
      // return all shapes empty so client shows "No active wrinkle"
      return NextResponse.json(
        { ok: true, data: null, row: null, wrinkle: null, rows: [], count: 0, game: null, games: [], linkedGame: null, wrinkleGames: [] },
        { status: 200 }
      );
    }

    // 2) load linked wrinkle_games with joined games
    const { data: wgs, error: wgErr } = await db
      .from("wrinkle_games")
      .select("*, game:games(*)")
      .eq("wrinkle_id", wrinkle.id);

    if (wgErr) return jErr("Failed to load linked games.", 500, wgErr.message);

    const normalized = (wgs ?? []).map((wg) => ({
      wrinkle_game: wg,
      game: wg?.game ?? null,
      normalized: normalizeGame(wg),
    }));

    const first = normalized[0] ?? null;
    const firstGame = first?.game ?? null;
    const firstNorm = first?.normalized ?? null;

    // 3) return a payload with MANY aliases so the client can latch onto something it expects
    return NextResponse.json(
      {
        ok: true,

        // primary
        data: wrinkle,        // the wrinkle object
        row: wrinkle,
        wrinkle,

        // legacy list shapes
        rows: wrinkle ? [wrinkle] : [],
        count: wrinkle ? 1 : 0,

        // games alongside wrinkle
        wrinkleGames: normalized,                     // [{wrinkle_game, game, normalized}]
        games: normalized.map((x) => x.game).filter(Boolean),
        game: firstGame ?? null,

        // normalized single helpful object for UIs
        linkedGame: firstNorm ?? null,

        // (optional) also surface on wrinkle for older UIs
        // @ts-ignore
        wrinkle_game: first?.wrinkle_game ?? null,
        // @ts-ignore
        wrinkle_linked_game: firstNorm ?? null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return jErr("Unexpected server error.", 500, e?.message ?? String(e));
  }
}

