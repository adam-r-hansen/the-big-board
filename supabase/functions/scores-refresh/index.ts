// @ts-nocheck
// supabase/functions/scores-refresh/index.ts
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ESPN_URL =
  Deno.env.get("ESPN_SCOREBOARD_URL") ??
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

// Window tuning for “which weeks to refresh”
const PAST_HOURS = Number(Deno.env.get("SCORES_PAST_HOURS") ?? 12);
const FUTURE_HOURS = Number(Deno.env.get("SCORES_FUTURE_HOURS") ?? 18);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type ExtGame = {
  espn_id: string;
  season?: number;
  week?: number;
  start_utc?: string | null;
  status?: "UPCOMING" | "LIVE" | "FINAL";
  home_abbr?: string;
  away_abbr?: string;
  home_score?: number | null;
  away_score?: number | null;
};

function stdStatus(rawState?: string, completed?: boolean): "UPCOMING" | "LIVE" | "FINAL" {
  const s = (rawState || "").toLowerCase();
  if (completed) return "FINAL";
  if (s === "in" || s === "inprogress" || s === "live") return "LIVE";
  return "UPCOMING";
}

function toIso(x?: string): string | null {
  if (!x) return null;
  const d = new Date(x);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function kickedOff(startIso?: string | null): boolean {
  if (!startIso) return false;
  const t = new Date(startIso).getTime();
  return Number.isFinite(t) && t <= Date.now();
}

async function fetchEspnScoreboard(season: number, week?: number): Promise<ExtGame[]> {
  const qs = new URLSearchParams({ seasontype: "2", dates: String(season) });
  if (typeof week === "number") qs.set("week", String(week));
  const url = `${ESPN_URL}?${qs.toString()}`;

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  const data = await res.json();

  const events: any[] = Array.isArray(data?.events) ? data.events : [];
  const out: ExtGame[] = [];

  for (const ev of events) {
    const espn_id = String(ev?.id ?? "");
    if (!espn_id) continue;

    const comp = Array.isArray(ev?.competitions) ? ev.competitions[0] : undefined;
    const statusType = comp?.status?.type ?? ev?.status?.type ?? {};
    const state = statusType?.state; // "pre" | "in" | "post"
    const completed = Boolean(statusType?.completed);

    const startISO = toIso(ev?.date || comp?.date);

    const comps = Array.isArray(comp?.competitors) ? comp.competitors : [];
    const home = comps.find((c: any) => (c?.homeAway || c?.homeaway) === "home");
    const away = comps.find((c: any) => (c?.homeAway || c?.homeaway) === "away");

    const home_abbr = String(home?.team?.abbreviation || "").toUpperCase() || undefined;
    const away_abbr = String(away?.team?.abbreviation || "").toUpperCase() || undefined;

    const hScoreRaw =
      home?.score != null ? Number(home.score) : home?.team?.score != null ? Number(home.team.score) : null;
    const aScoreRaw =
      away?.score != null ? Number(away.score) : away?.team?.score != null ? Number(away.team.score) : null;

    const home_score = Number.isFinite(hScoreRaw) ? Number(hScoreRaw) : null;
    const away_score = Number.isFinite(aScoreRaw) ? Number(aScoreRaw) : null;

    // ---- Status derivation (hardened) ----
    // 1) Use ESPN’s state first
    let s: "UPCOMING" | "LIVE" | "FINAL" = stdStatus(state, completed);
    // 2) If ESPN still says UPCOMING but kickoff has passed OR any score exists, treat as LIVE
    if (s === "UPCOMING" && !completed && (kickedOff(startISO) || home_score !== null || away_score !== null)) {
      s = "LIVE";
    }
    // 3) If completed, always FINAL
    if (completed) s = "FINAL";
    // --------------------------------------

    out.push({
      espn_id,
      season,
      week,
      start_utc: startISO,
      status: s,
      home_abbr,
      away_abbr,
      home_score,
      away_score,
    });
  }

  return out;
}

async function findWindowPairs(): Promise<Array<{ season: number; week: number }>> {
  const now = Date.now();
  const fromIso = new Date(now - PAST_HOURS * 3600 * 1000).toISOString();
  const toIso_ = new Date(now + FUTURE_HOURS * 3600 * 1000).toISOString();

  const { data, error } = await supabase
    .from("games")
    .select("season, week")
    .gte("game_utc", fromIso)
    .lte("game_utc", toIso_);
  if (error) throw error;

  const uniq = new Map<string, { season: number; week: number }>();
  for (const r of data || []) {
    if (typeof r.season === "number" && typeof r.week === "number") {
      uniq.set(`${r.season}-${r.week}`, { season: r.season, week: r.week });
    }
  }
  return Array.from(uniq.values()).sort((a, b) => (a.season - b.season) || (a.week - b.week));
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const seasonQ = url.searchParams.get("season");
    const weekQ = url.searchParams.get("week");
    const seasonOverride = seasonQ ? Number(seasonQ) : undefined;
    const weekOverride = weekQ ? Number(weekQ) : undefined;

    const { data: teams, error: tErr } = await supabase.from("teams").select("id, abbreviation");
    if (tErr) throw tErr;
    const abbrToId = new Map<string, string>();
    (teams || []).forEach((t: any) => {
      if (t?.abbreviation && t?.id) abbrToId.set(String(t.abbreviation).toUpperCase(), t.id);
    });

    let pairs: Array<{ season: number; week: number }> = [];
    if (typeof seasonOverride === "number" && typeof weekOverride === "number") {
      pairs = [{ season: seasonOverride, week: weekOverride }];
    } else if (typeof seasonOverride === "number") {
      const windowPairs = await findWindowPairs();
      pairs = windowPairs.filter((p) => p.season === seasonOverride);
    } else {
      pairs = await findWindowPairs();
    }

    if (pairs.length === 0) {
      const now = Date.now();
      const fromIso = new Date(now - PAST_HOURS * 3600 * 1000).toISOString();
      const toIso_ = new Date(now + FUTURE_HOURS * 3600 * 1000).toISOString();
      return new Response(
        JSON.stringify({ ok: true, skipped: "no games in window", window: { fromIso, toIso } }),
        { headers: { "content-type": "application/json", "cache-control": "no-store" } },
      );
    }

    let matched = 0;
    let updated = 0;

    for (const { season, week } of pairs) {
      const extGames = await fetchEspnScoreboard(season, week);

      const byEspn = new Map(extGames.map((e) => [e.espn_id, e]));
      const byKey = new Map<string, ExtGame>(); // "HOME-AWAY-ISO"
      for (const e of extGames) {
        const key = `${e.home_abbr || ""}-${e.away_abbr || ""}-${e.start_utc || ""}`;
        byKey.set(key, e);
      }

      const { data: games, error: gErr } = await supabase
        .from("games")
        .select("id, season, week, game_utc, status, home_team, away_team, home_score, away_score, espn_id")
        .eq("season", season)
        .eq("week", week);
      if (gErr) throw gErr;

      for (const g of games || []) {
        let eg: ExtGame | undefined;

        if (g.espn_id && byEspn.has(g.espn_id)) eg = byEspn.get(g.espn_id);

        if (!eg) {
          const homeAbbr = [...abbrToId.entries()].find(([, id]) => id === g.home_team)?.[0];
          const awayAbbr = [...abbrToId.entries()].find(([, id]) => id === g.away_team)?.[0];
          const kIso = g.game_utc ? new Date(g.game_utc).toISOString() : "";
          const key = `${homeAbbr || ""}-${awayAbbr || ""}-${kIso}`;
          eg = byKey.get(key);
        }

        if (!eg) continue;
        matched++;

        const s = eg.status ?? "UPCOMING";
        const hs = eg.home_score ?? null;
        const as = eg.away_score ?? null;

        const changed =
          s !== (g.status || "UPCOMING") ||
          (hs !== null && hs !== g.home_score) ||
          (as !== null && as !== g.away_score) ||
          (!g.espn_id && eg.espn_id);

        if (!changed) continue;

        const { error: uErr } = await supabase
          .from("games")
          .update({
            status: s,
            home_score: hs,
            away_score: as,
            espn_id: g.espn_id || eg.espn_id,
          })
          .eq("id", g.id);

        if (!uErr) updated++;
      }
    }

    return new Response(JSON.stringify({ ok: true, matched, updated, processed: pairs }), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
});
