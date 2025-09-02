import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get("leagueId")?.trim();
  const season = Number(searchParams.get("season"));
  const week = Number(searchParams.get("week"));

  if (!season || !week) {
    return NextResponse.json(
      { ok: false, error: { message: "season and week are required" } },
      { status: 400 }
    );
  }

  let q = db.from("wrinkles").select("*").eq("season", season).eq("week", week);
  if (leagueId) q = q.eq("league_id", leagueId);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      { ok: false, error: { message: "Failed to fetch wrinkles", details: error.message } },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, data }, { status: 200 });
}

