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

function err(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { message, details: details ?? null } },
    { status }
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const seasonStr = searchParams.get("season");
    const weekStr = searchParams.get("week");
    const leagueId = (searchParams.get("leagueId") ?? "").trim(); // may be ""

    const season = Number(seasonStr);
    const week = Number(weekStr);
    if (!season || !week) {
      return err("Query params 'season' and 'week' are required (numbers).");
    }

    // Base query for this season/week
    let q = db
      .from("wrinkles")
      .select("*")
      .eq("season", season)
      .eq("week", week);

    // If leagueId is provided, we want either the league-specific row OR a global row (league_id IS NULL)
    // Supabase '.or' takes a string expression.
    if (leagueId) {
      // prefer league match by ordering later, but include global fallback in filter
      q = q.or(`league_id.eq.${leagueId},league_id.is.null`);
    }

    // Prefer league-specific over global; if ties, prefer most recently created/updated.
    // Adjust column names if your schema uses different timestamp fields.
    const { data, error } = await q
      .order("league_id", { ascending: false, nullsFirst: false }) // non-null (specific) first
      .order("updated_at", { ascending: false, nullsFirst: true })
      .order("created_at", { ascending: false, nullsFirst: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      return err("Failed to fetch active wrinkle.", 500, error.message);
    }

    // If nothing matched and a leagueId was given, do a last-resort global search (no league filter at all)
    let row = data ?? null;
    if (!row && leagueId) {
      const { data: globalOnly, error: e2 } = await db
        .from("wrinkles")
        .select("*")
        .eq("season", season)
        .eq("week", week)
        .is("league_id", null)
        .order("updated_at", { ascending: false, nullsFirst: true })
        .order("created_at", { ascending: false, nullsFirst: true })
        .limit(1)
        .maybeSingle();
      if (e2) {
        return err("Failed to fetch global fallback wrinkle.", 500, e2.message);
      }
      row = globalOnly ?? null;
    }

    // Return explicit null when there is no configured wrinkle
    return NextResponse.json({ ok: true, data: row }, { status: 200 });
  } catch (e: any) {
    return err("Unexpected server error.", 500, e?.message ?? String(e));
  }
}

