// app/api/wrinkles/[id]/picks/route.ts
/* 
  Wrinkles Picks API
  - Works with Next 14 & 15 param types (params may be a Promise)
  - Uses await cookies() for auth token
  - Uses Supabase service-role for delete+insert
  - Consistent JSON error responses
*/

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// ---------- RUNTIME & CORS (server only) ----------
export const runtime = "nodejs"; // ensure Node.js runtime (no edge; service key stays server-only)

// ---------- TYPES ----------
type ParamShape = { id: string };

// Body for POST
type PostBody = {
  selection: string; // e.g., a teamId or pick value
  kind?: string;     // optional, if your schema uses a kind enum/column
};

// ---------- UTIL: unwrap params (Next 14 object vs Next 15 Promise) ----------
async function unwrapParams(
  paramsOrPromise: ParamShape | Promise<ParamShape>
): Promise<ParamShape> {
  const maybe: any = paramsOrPromise as any;
  return typeof maybe?.then === "function"
    ? await (paramsOrPromise as Promise<ParamShape>)
    : (paramsOrPromise as ParamShape);
}

// ---------- UTIL: uniform JSON success/error ----------
function jsonOk(data: unknown, init?: number | ResponseInit) {
  const status = typeof init === "number" ? init : undefined;
  const initObj: ResponseInit | undefined =
    typeof init === "object" ? init : status ? { status } : undefined;
  return NextResponse.json({ ok: true, data }, initObj);
}

function jsonErr(
  message: string,
  opts?: { status?: number; code?: string; details?: unknown }
) {
  const status = opts?.status ?? 400;
  return NextResponse.json(
    {
      ok: false,
      error: {
        message,
        code: opts?.code ?? "BAD_REQUEST",
        details: opts?.details ?? null,
      },
    },
    { status }
  );
}

// ---------- SUPABASE (service-role) ----------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create an admin client (server-only)
const supabaseAdmin = (() => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // We throw here so builds fail loudly if env is missing
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var(s)."
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "wrinkles-picks-route" } },
  });
})();

// ---------- AUTH: get current user from sb-access-token cookie ----------
async function getAuthUser() {
  const c = await cookies();
  // Supabase Auth helpers (Next) commonly set these; use access token if present
  const accessToken =
    c.get("sb-access-token")?.value ??
    c.get("sb:token")?.value ?? // fallback if your project used a different cookie
    "";

  if (!accessToken) {
    return { user: null as const, error: "No access token cookie found." };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error) {
    return { user: null as const, error: error.message };
  }
  return { user: data.user, error: null };
}

// ---------- TABLE NAMES & COLUMNS (adjust to your schema) ----------
const PICKS_TABLE = "picks";
// Columns assumed: user_id, wrinkle_id, selection, kind?, created_at?
// If your column names differ, update the queries below.

// ===================== GET =====================
export async function GET(
  _req: NextRequest,
  context: { params: ParamShape | Promise<ParamShape> }
) {
  try {
    const { id: wrinkleId } = await unwrapParams(context.params);

    const { user, error: authErr } = await getAuthUser();
    if (!user) {
      return jsonErr("Unauthorized", { status: 401, code: "UNAUTHORIZED", details: authErr });
    }

    const { data, error } = await supabaseAdmin
      .from(PICKS_TABLE)
      .select("*")
      .eq("user_id", user.id)
      .eq("wrinkle_id", wrinkleId)
      .maybeSingle();

    if (error) {
      return jsonErr("Failed to fetch pick.", {
        status: 500,
        code: "DB_SELECT_ERROR",
        details: error.message,
      });
    }

    return jsonOk({ pick: data ?? null }, 200);
  } catch (err: any) {
    return jsonErr("Unexpected server error.", {
      status: 500,
      code: "UNHANDLED",
      details: err?.message ?? String(err),
    });
  }
}

// ===================== POST =====================
// Idempotent style: delete existing pick for (user, wrinkle) then insert new one
export async function POST(
  req: NextRequest,
  context: { params: ParamShape | Promise<ParamShape> }
) {
  try {
    const { id: wrinkleId } = await unwrapParams(context.params);

    const { user, error: authErr } = await getAuthUser();
    if (!user) {
      return jsonErr("Unauthorized", { status: 401, code: "UNAUTHORIZED", details: authErr });
    }

    // Ensure cookies() is awaited (we already do that in getAuthUser)
    await cookies(); // no-op but satisfies your "await cookies()" requirement explicitly

    let body: PostBody;
    try {
      body = (await req.json()) as PostBody;
    } catch {
      return jsonErr("Invalid JSON body.", { status: 400, code: "BAD_JSON" });
    }

    if (!body?.selection || typeof body.selection !== "string") {
      return jsonErr('Missing or invalid "selection".', {
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }

    // 1) Delete existing
    const { error: delErr } = await supabaseAdmin
      .from(PICKS_TABLE)
      .delete()
      .eq("user_id", user.id)
      .eq("wrinkle_id", wrinkleId);

    if (delErr) {
      return jsonErr("Failed to clear previous pick.", {
        status: 500,
        code: "DB_DELETE_ERROR",
        details: delErr.message,
      });
    }

    // 2) Insert new
    const payload: Record<string, any> = {
      user_id: user.id,
      wrinkle_id: wrinkleId,
      selection: body.selection,
    };
    if (body.kind) payload.kind = body.kind;

    const { data, error: insErr } = await supabaseAdmin
      .from(PICKS_TABLE)
      .insert(payload)
      .select("*")
      .single();

    if (insErr) {
      return jsonErr("Failed to insert pick.", {
        status: 500,
        code: "DB_INSERT_ERROR",
        details: insErr.message,
      });
    }

    return jsonOk({ pick: data }, 201);
  } catch (err: any) {
    return jsonErr("Unexpected server error.", {
      status: 500,
      code: "UNHANDLED",
      details: err?.message ?? String(err),
    });
  }
}

// ===================== DELETE =====================
export async function DELETE(
  _req: NextRequest,
  context: { params: ParamShape | Promise<ParamShape> }
) {
  try {
    const { id: wrinkleId } = await unwrapParams(context.params);

    const { user, error: authErr } = await getAuthUser();
    if (!user) {
      return jsonErr("Unauthorized", { status: 401, code: "UNAUTHORIZED", details: authErr });
    }

    const { error: delErr, count } = await supabaseAdmin
      .from(PICKS_TABLE)
      .delete({ count: "exact" })
      .eq("user_id", user.id)
      .eq("wrinkle_id", wrinkleId);

    if (delErr) {
      return jsonErr("Failed to delete pick.", {
        status: 500,
        code: "DB_DELETE_ERROR",
        details: delErr.message,
      });
    }

    return jsonOk({ deleted: count ?? 0 }, 200);
  } catch (err: any) {
    return jsonErr("Unexpected server error.", {
      status: 500,
      code: "UNHANDLED",
      details: err?.message ?? String(err),
    });
  }
}

