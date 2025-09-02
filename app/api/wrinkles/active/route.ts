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
function jOk(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // Use the *raw strings* to avoid numeric casting issues if your columns are text
    const seasonParam = (searchParams.get("season") ?? "").trim();
    const weekParam = (searchParams.get("week") ?? "").trim();
    const leagueId = (searchParams.get("leagueId") ?? "").trim(); // may be ""

    if (!seasonParam || !weekParam) {
      return jErr("Query params 'season' and 'week' are required.", 400, {
        season: seasonParam,
        week: weekParam,
      });
    }

    // 1) Try league-specific (if provided)
    if (leagueId) {
      const { data, error } = await db
        .from("wrinkles")
        .select("*")
        .eq("season", seasonParam) // compare as strings to avoid type mismatch
        .eq("week", weekParam)
        .eq("league_id", leagueId)
        .limit(1)
        .maybeSingle();

      if (error) {
        // Return structured error so we can see it in Network tab
        return jErr("Failed to fetch league-specific wrinkle.", 500, error.message);
      }
      if (data) return jOk(data, 200);
      // fall through to global check
    }

    // 2) Global (league_id IS NULL)
    const { data: globalRow, error: gErr } = await db
      .from("wrinkles")
      .select("*")
      .eq("season", seasonParam)
      .eq("week", weekParam)
      .is("league_id", null)
      .limit(1)
      .maybeSingle();

    if (gErr) {
      return jErr("Failed to fetch global wrinkle.", 500, gErr.message);
    }

    // Explicitly return null if nothing configured
    return jOk(globalRow ?? null, 200);
  } catch (e: any) {
    return jErr("Unexpected server error.", 500, e?.message ?? String(e));
  }
}

