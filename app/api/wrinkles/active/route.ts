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

// We return multiple fields so old client code keeps working, no matter what it expects.
//  - ok/data:         { ok:true, data: row|null }
//  - row/wrinkle:     single object (or null)
//  - rows:            array ([] or [row])
//  - count:           0 or 1
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

    // 1) Try league-specific row (if leagueId provided)
    let row: any = null;
    if (leagueId) {
      const { data, error } = await db
        .from("wrinkles")
        .select("*")
        .eq("season", seasonParam) // string compare works for int/text columns
        .eq("week",   weekParam)
        .eq("league_id", leagueId)
        .limit(1)
        .maybeSingle();

      if (error) return jErr("Failed to fetch league-specific wrinkle.", 500, error.message);
      row = data ?? null;
    }

    // 2) Fallback to global (league_id is null)
    if (!row) {
      const { data: globalRow, error: gErr } = await db
        .from("wrinkles")
        .select("*")
        .eq("season", seasonParam)
        .eq("week",   weekParam)
        .is("league_id", null)
        .limit(1)
        .maybeSingle();

      if (gErr) return jErr("Failed to fetch global wrinkle.", 500, gErr.message);
      row = globalRow ?? null;
    }

    const rows  = row ? [row] : [];
    const count = row ? 1 : 0;

    return NextResponse.json(
      {
        ok: true,
        data: row,        // new shape
        row,              // alt single
        wrinkle: row,     // legacy single
        rows,             // legacy array
        count,            // legacy count
      },
      { status: 200 },
    );
  } catch (e: any) {
    return jErr("Unexpected server error.", 500, e?.message ?? String(e));
  }
}

