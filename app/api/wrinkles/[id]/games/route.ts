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

export async function GET(
  _req: NextRequest,
  ctx: { params: ParamShape | Promise<ParamShape> }
) {
  try {
    const { id: wrinkleId } = await unwrapParams(ctx.params);

    // Fetch wrinkle_games AND join to the games table
    // Requires a foreign key: wrinkle_games.game_id -> games.id
    const { data, error } = await db
      .from("wrinkle_games")
      .select("*, game:games(*)") // join games as nested "game"
      .eq("wrinkle_id", wrinkleId);

    if (error) {
      return jErr("Failed to fetch wrinkle_games with game join.", 500, error.message);
    }

    // Backward compatible shapes
    return NextResponse.json(
      {
        ok: true,
        data,       // array of { id, wrinkle_id, game_id, ..., game: { ... } }
        rows: data,
        count: data?.length ?? 0,
        row: data?.[0] ?? null,
        wrinkle_game: data?.[0] ?? null,
        game: data?.[0]?.game ?? null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return jErr("Unexpected server error.", 500, e?.message ?? String(e));
  }
}

