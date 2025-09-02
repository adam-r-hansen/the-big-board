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

function jsonErr(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { message, details: details ?? null } },
    { status }
  );
}

function jsonOk(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const seasonStr = (searchParams.get("season") || "").trim();
    const weekStr = (searchParams.get("week") || "").trim();
    const leagueId = (searchParams.get("leagueId") || "").trim(); // may be ""

    const season = Number(seasonStr);
    const week = Number(weekStr);
    if (!Number.isFinite(season) || !Number.isFinite(week) || !season || !week) {
      return jsonErr("Query params 'season' and 'week' are required numbers.", 400, {
        season: seasonStr,
        week: weekStr,
      });
    }

    // 1) If a leagueId is provided, try that exact wrinkle first.
    if (leagueId) {
      const { data: leagueRow, error: leagueErr } = await db
        .from("wrinkles")
        .select("*")
        .eq("season", season)
        .eq("week", week)
        .eq("league_id", leagueId)
        .limit(1)
        .maybeSingle();

      if (leagueErr) {
        return jsonErr("Failed to fetch league-specific wrinkle.", 500, leagueErr.message);
      }
      if (leagueRow) {
        return jsonOk(leagueRow, 200);
      }
      // Fall through to global if none found.
    }

    // 2) Global fallback (league_id IS NULL) or the only available for that week.
    const { data: globalRow, error: globalErr } = await db
      .from("wrinkles")
      .select("*")
      .eq("season", season)
      .eq("week", week)
      .is("league_id", null)
      .limit(1)
      .maybeSingle();

    if (globalErr) {
      return jsonErr("Failed to fetch global wrinkle.", 500, globalErr.message);
    }

    // Explicitly return null when nothing exists for this week.
    return jsonOk(globalRow ?? null, 200);
  } catch (e: any) {
    return jsonErr("Unexpected server error.", 500, e?.message ?? String(e));
  }
}

