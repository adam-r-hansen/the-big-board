// app/api/wrinkles/[id]/games/debug/route.ts
import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type ParamShape = { id: string };
async function unwrapParams(p: ParamShape | Promise<ParamShape>) {
  const maybe: any = p as any;
  return typeof maybe?.then === "function"
    ? await (p as Promise<ParamShape>)
    : (p as ParamShape);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { "X-Client-Info": "wrinkles-games-debug" } },
});

export async function GET(_req: NextRequest, ctx: { params: ParamShape | Promise<ParamShape> }) {
  try {
    const { id } = await unwrapParams(ctx.params);

    const { data: wgRows, error: wgErr } = await db
      .from("wrinkle_games")
      .select("*")
      .eq("wrinkle_id", id);

    if (wgErr) {
      return NextResponse.json(
        { ok: false, error: { message: "wrinkle_games query failed", details: wgErr.message } },
        { status: 500 }
      );
    }

    const gameIds =
      wgRows?.map((r: any) => r?.game_id).filter((x: any) => typeof x === "string") ?? [];

    const games =
      gameIds.length > 0
        ? await db.from("games").select("*").in("id", gameIds)
        : { data: [] as any[], error: null };

    if ((games as any).error) {
      return NextResponse.json(
        { ok: false, error: { message: "games query failed", details: (games as any).error?.message } },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        wrinkle_id: id,
        wrinkle_games: wgRows ?? [],
        games: (games as any).data ?? [],
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: { message: "server error", details: e?.message ?? String(e) } },
      { status: 500 }
    );
  }
}
