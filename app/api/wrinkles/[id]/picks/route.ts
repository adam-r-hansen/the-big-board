// app/api/wrinkles/[id]/picks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";

type ParamShape = { id: string };
type PickBody = { selection?: string | null; teamId?: string | null };

function j(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

async function unwrapParams(p: ParamShape | Promise<ParamShape>) {
  const maybe: any = p as any;
  return typeof maybe?.then === "function" ? await (p as Promise<ParamShape>) : (p as ParamShape);
}

export async function POST(
  req: NextRequest,
  context: { params: ParamShape | Promise<ParamShape> }
) {
  try {
    const { id: wrinkleId } = await unwrapParams(context.params);

    // 1) Auth exactly like weekly routes: use auth-helpers with request cookies
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return j(401, { ok: false, error: { message: "Unauthorized", details: userErr?.message ?? null } });
    }

    // 2) Parse body
    let body: PickBody = {};
    try {
      body = (await req.json()) as PickBody;
    } catch {
      /* ignore */
    }

    const teamId = (body?.selection ?? body?.teamId ?? "").toString().trim() || null;
    if (!teamId) {
      return j(400, {
        ok: false,
        error: { message: "Missing team selection.", details: "Provide { selection: <teamId> }." },
      });
    }

    // Optional sanity: ensure wrinkle exists and is active
    const { data: wr, error: werr } = await supabase
      .from("wrinkles")
      .select("id, status")
      .eq("id", wrinkleId)
      .maybeSingle();

    if (werr) return j(500, { ok: false, error: { message: "Failed to load wrinkle.", details: werr.message } });
    if (!wr) return j(404, { ok: false, error: { message: "Wrinkle not found." } });
    if (wr.status && wr.status !== "active") {
      return j(400, { ok: false, error: { message: "Wrinkle is not active." } });
    }

    // 3) Find the linked game for this wrinkle (so we store it with the pick)
    const { data: wg, error: wgErr } = await supabase
      .from("wrinkle_games")
      .select("game_id")
      .eq("wrinkle_id", wrinkleId)
      .maybeSingle();

    if (wgErr) return j(500, { ok: false, error: { message: "Failed to load linked game.", details: wgErr.message } });

    // 4) Upsert the wrinkle pick under current user (RLS should match weekly policy)
    //    If you enforced a UNIQUE (wrinkle_id, profile_id), this will be safe to repeat.
    const { error: upsertErr } = await supabase
      .from("wrinkle_picks")
      .upsert(
        {
          wrinkle_id: wrinkleId,
          profile_id: user.id, // same id weekly flow uses for profile_id (auth.uid())
          team_id: teamId,
          game_id: wg?.game_id ?? null,
        },
        { onConflict: "wrinkle_id,profile_id" }
      );

    if (upsertErr) {
      return j(403, { ok: false, error: { message: "Not allowed to save wrinkle pick.", details: upsertErr.message } });
    }

    return j(200, { ok: true });
  } catch (e: any) {
    return j(500, { ok: false, error: { message: "Unexpected server error.", details: e?.message ?? String(e) } });
  }
}

