// app/api/wrinkles/[id]/picks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type ParamShape = { id: string };
type PickBody = { selection?: string | null; teamId?: string | null };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { "X-Client-Info": "wrinkles-picks-route" } },
});

function j(status: number, payload: any) {
  return NextResponse.json(payload, { status });
}

async function unwrapParams(p: ParamShape | Promise<ParamShape>) {
  const maybe: any = p as any;
  return typeof maybe?.then === "function" ? await (p as Promise<ParamShape>) : (p as ParamShape);
}

/**
 * Pull a Supabase access token from:
 * - Cookie "sb-access-token"  (auth-helpers)
 * - Cookie "access_token"     (custom)
 * - Cookie "supabase-auth-token" (sometimes a JSON array, we unpack)
 * - Authorization: Bearer <token> header (fallback)
 */
function readAccessToken(req: NextRequest): string | null {
  const c = nextCookies();

  // 1) sb-access-token (common)
  const sb = c.get("sb-access-token")?.value;
  if (sb && sb.trim()) return sb;

  // 2) access_token (older custom)
  const at = c.get("access_token")?.value;
  if (at && at.trim()) return at;

  // 3) supabase-auth-token — may be JSON (array or object)
  const satRaw = c.get("supabase-auth-token")?.value;
  if (satRaw) {
    try {
      const parsed = JSON.parse(satRaw);
      // Newer helpers sometimes store as ["access","refresh"]
      if (Array.isArray(parsed) && typeof parsed[0] === "string" && parsed[0]) {
        return parsed[0];
      }
      // Or as { currentSession: { access_token: "..." } }
      const maybe = (parsed as any)?.currentSession?.access_token;
      if (typeof maybe === "string" && maybe) return maybe;
    } catch {
      // ignore JSON parse errors
    }
  }

  // 4) Authorization: Bearer <token>
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }

  return null;
}

async function requireUser(req: NextRequest) {
  const accessToken = readAccessToken(req);
  if (!accessToken) {
    return { user: null as const, error: "No access token cookie or header found." };
  }
  const { data, error } = await db.auth.getUser(accessToken);
  if (error || !data?.user) {
    return {
      user: null as const,
      error: error?.message || "Invalid session token (not authenticated).",
    };
  }
  return { user: data.user, error: null as const };
}

export async function POST(
  req: NextRequest,
  context: { params: ParamShape | Promise<ParamShape> }
) {
  try {
    const { id: wrinkleId } = await unwrapParams(context.params);

    // 1) Auth gate
    const { user, error: authErr } = await requireUser(req);
    if (!user) {
      return j(401, { ok: false, error: { message: "Unauthorized", details: authErr } });
    }

    // 2) Payload
    let body: PickBody = {};
    try {
      body = (await req.json()) as PickBody;
    } catch {
      // ignore; we'll validate below
    }

    const teamId =
      (body?.selection ?? body?.teamId ?? "").toString().trim() || null;

    if (!teamId) {
      return j(400, {
        ok: false,
        error: { message: "Missing team selection.", details: "Provide { selection: <teamId> }." },
      });
    }

    // 3) Make sure the wrinkle exists (defensive) and is for this season/week (optional)
    const { data: wr, error: werr } = await db
      .from("wrinkles")
      .select("id, kind, status")
      .eq("id", wrinkleId)
      .maybeSingle();
    if (werr) return j(500, { ok: false, error: { message: "Failed to load wrinkle.", details: werr.message } });
    if (!wr) return j(404, { ok: false, error: { message: "Wrinkle not found." } });
    if (wr.status && wr.status !== "active") {
      // optional rule: you can remove this check if not needed
      return j(400, { ok: false, error: { message: "Wrinkle is not active." } });
    }

    // 4) Write the pick:
    // Strategy: delete any prior pick for (user_id, wrinkle_id), then insert fresh pick.
    // Table is assumed to be "wrinkle_picks" with columns:
    //   user_id (uuid), wrinkle_id (uuid), team_id (uuid or string), created_at timestamptz default now()
    const { error: delErr } = await db
      .from("wrinkle_picks")
      .delete()
      .eq("user_id", user.id)
      .eq("wrinkle_id", wrinkleId);

    if (delErr) {
      return j(500, {
        ok: false,
        error: { message: "Failed to clear previous pick.", details: delErr.message },
      });
    }

    const { data: ins, error: insErr } = await db
      .from("wrinkle_picks")
      .insert({
        user_id: user.id,
        wrinkle_id: wrinkleId,
        team_id: teamId,
      })
      .select("*")
      .maybeSingle();

    if (insErr) {
      return j(500, {
        ok: false,
        error: { message: "Failed to save pick.", details: insErr.message },
      });
    }

    return j(200, { ok: true, data: ins });
  } catch (e: any) {
    return j(500, {
      ok: false,
      error: { message: "Unexpected server error.", details: e?.message ?? String(e) },
    });
  }
}

