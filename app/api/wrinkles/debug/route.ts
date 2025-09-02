// app/api/wrinkles/debug/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { "X-Client-Info": "wrinkles-debug-route" } },
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const season = (searchParams.get("season") ?? "").trim();
    const week = (searchParams.get("week") ?? "").trim();

    if (!season || !week) {
      return NextResponse.json(
        { ok: false, error: { message: "season and week required" } },
        { status: 400 }
      );
    }

    const { data: all, error } = await db
      .from("wrinkles")
      .select("*")
      .eq("season", season)
      .eq("week", week);

    if (error) {
      return NextResponse.json(
        { ok: false, error: { message: "query failed", details: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, count: all?.length ?? 0, rows: all ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: { message: "server error", details: e?.message ?? String(e) } },
      { status: 500 }
    );
  }
}

