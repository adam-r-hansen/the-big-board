// app/api/wrinkles/[id]/picks/route.ts
import { NextRequest, NextResponse } from "next/server";
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
 * Pull a Supabase access token from the incoming request:
 * - Cookie "sb-<projectRef>-auth-token" (new, JSON: ["access","refresh"])
 * - Cookie "sb-access-token"            (older)
 * - Cookie "access_token"               (custom/legacy)
 * - Cookie "supabase-auth-token"        (sometimes JSON; we unpack)
 * - Authorization: Bearer <token>       (fallback)
 */
function readAccessToken(req: NextRequest): string | null {
  const getCookie = (name: string) => req.cookies.get(name)?.value;

  // 1) Project-scoped cookie(s): sb-<projectRef>-auth-token
  for (const c of req.cookies.getAll()) {
    const name = c.name ?? "";
    if (name.startsWith("sb-") && name.endsWith("-auth-token")) {
      const raw = c.value;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          // Most common form is ["access_token", "refresh_token"]
          if (Array.isArray(parsed) && typeof parsed[0] === "string" && parsed[0]) {
            return parsed[0];
          }
          // Some helpers store { access_token } or { currentSession: { access_token } }
          const direct = (parsed as any)?.access_token;
          if (typeof direct === "string" && direct) return direct;
          const nested = (parsed as any)?.currentSession?.access_token;
          if (typeof nested === "string" && nested) return nested;
        } catch {
          // ignore JSON parse errors
        }
      }
    }
  }

  // 2) sb-access-token (older)
  const sb = getCookie("sb-access-token");
  if (sb && sb.trim()) return sb;

  // 3) access_token (custom legacy)
  const at = getCookie("access_token");
  if (at && at.trim()) return at;

  // 4) supabase-auth-token — may be JSON we must unpack
  const satRaw = getCookie("supabase-auth-token");
  if (satRaw) {
    try {
      const parsed = JSON.parse(satRaw);
      if (Array.isArray(parsed) && typeof parsed[0] === "string" && parsed[0]) {
        return parsed[0];
      }
      const maybe = (parsed as any)?.currentSession?.access_token;
      if (typeof maybe === "string" && maybe) return maybe;
      const direct = (parsed as any)?.access_token;
      if (typeof direct === "string" && direct) return direct;
    } catch {
      // ignore
    }
  }

  // 5) Authorization: Bearer <token>
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }

  return null;
}

async function requireUser(req: NextRequest): Promise<{ user: any | null; error: string | null }> {
  const accessToken = readAccessToken(req);
  if (!accessToken) {
    return { user: null, error: "No access token found in cookies or Authorization header." };
  }
  const { data, error } = await db.auth.getUser(accessToken);
  if (error || !data?.user) {
    return { user: null, error: error?.message || "Invalid/expired session token." };
  }
  return { user: data.user, error: null };
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

    // 2) Parse payload
    let body: PickBody = {};
    try {
      body = (await req.json()) as PickBody;
    } catch {
      /* ignore; we'll validate below */
    }

    const teamId = (body?.selection ?? body?.teamId ?? "").toString().trim() || null;
    if (!teamId) {
      return j(400, {
        ok: false,
        error: { message: "Missing team selection.", details: "Provide { selection: <teamId> }." },
      });
    }

    // 3) Ensure wrinkle exists and is active (optional rule)
    const { data: wr, error: werr } = await db
      .from("wrinkles")
      .select("id, kind, status")
      .eq("id", wrinkleId)
      .maybeSingle();
    if (werr) {
      return j(500, { ok: false, error: { message: "Failed to load wrinkle.", details: werr.message } });
    }
    if (!wr) return j(404, { ok: false, error: { message: "Wrinkle not found." } });
    if (wr.status && wr.status !== "active") {
      return j(400, { ok: false, error: { message: "Wrinkle is not active." } });
    }

    // 4) Upsert pick for (user, wrinkle)
    const { error: delErr } = await db
      .from("wrinkle_picks")
      .delete()
      .eq("user_id", user.id)
      .eq("wrinkle_id", wrinkleId);
    if (delErr) {
      return j(500, { ok: false, error: { message: "Failed to clear previous pick.", details: delErr.message } });
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
      return j(500, { ok: false, error: { message: "Failed to save pick.", details: insErr.message } });
    }

    return j(200, { ok: true, data: ins });
  } catch (e: any) {
    return j(500, { ok: false, error: { message: "Unexpected server error.", details: e?.message ?? String(e) } });
  }
}

