// @ts-nocheck
// supabase/functions/scores-refresh/index.ts
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ESPN_URL =
  Deno.env.get("ESPN_SCOREBOARD_URL") ??
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"; // public

// Window tuning: how far around "now" to consider games "near".
// Extend future to catch early London/Europe kickoffs.
const PAST_HOURS = Number(Deno.env.get("SCORES_PAST_HOURS") ?? 12);   // look back this many hours
const FUTURE_HOURS = Number(Deno.env.get("SCORES_FUTURE_HOURS") ?? 18); // look ahead this many hours

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

async function fetchEspnScoreboard(season: number, week?: number): Promise<ExtGame[]> {
  // Regular season by default (seasontype=2). Adjust later if you want pre/postseason.
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
    const status = comp?.status?.type ?? ev?.status?.type ?? {};
    const state = status?.state; // "pre" | "in" | "post"
    const completed = Boolean(status?.completed);
    const s = stdStatus(state, completed);

    const comps = Array.isArray(comp?.competitors) ? comp.competitors : [];
    const home = comps.find((c: any) => (c?.homeAway || c?.homeaway) === "home");
    const away = comps.find((c: any) => (c?.homeAway || c?.homeaway) === "away");

    const home_abbr = String(home?.team?.abbreviation || "").toUpperCase() || undefined;
    const away_abbr = String(away?.team?.abbreviation || "").toUpperCase() || undefined;

    const home_score =
      home?.score != null ? Number(home.score) : home?.team?.score != null ? Number(home.team.score) : null;
    const away_score =
      away?.score != null ? Number(away.score) : away?.team?.score != null ? Number(away.team.score) : null;

    out.push({
      espn_id,
      season,
      week,
      start_utc: toIso(ev?.date || comp?.date),
      status: s,
      home_abbr,
      away_abbr,
      home_score: Number.isFinite(home_score) ? home_score : null,
      away_score: Number.isFinite(away_score) ? away_score : null,
    });
  }

  return out;
}

// Find (season, week) pairs that have games "near now" based on the window.
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
    // Optional overrides for manual invocations
    const seasonQ = url.searchParams.get("season");
    const weekQ = url.searchParams.get("week");
    const seasonOverride = seasonQ ? Number(seasonQ) : undefined;
    const weekOverride = weekQ ? Number(weekQ) : undefined;

    // Load teams once for abbr -> team.id mapping
    const { data: teams, error: tErr } = await supabase.from("teams").select("id, abbreviation");
    if (tErr) throw tErr;
    const abbrToId = new Map<string, string>();
    (teams || []).forEach((t: any) => {
      if (t?.abbreviation && t?.id) abbrToId.set(String(t.abbreviation).toUpperCase(), t.id);
    });

    // Build the list of (season, week) to process
    let pairs: Array<{ season: number; week: number }> = [];
    if (typeof seasonOverride === "number" && typeof weekOverride === "number") {
      pairs = [{ season: seasonOverride, week: weekOverride }];
    } else if (typeof seasonOverride === "number") {
      // No week specified: limit to weeks in window for that season
      const windowPairs = await findWindowPairs();
      pairs = windowPairs.filter((p) => p.season === seasonOverride);
    } else {
      // Neither specified: use window across all seasons present
      pairs = await findWindowPairs();
    }

    if (pairs.length === 0) {
      const now = Date.now();
      const fromIso = new Date(now - PAST_HOURS * 3600 * 1000).toISOString();
      const toIso_ = new Date(now + FUTURE_HOURS * 3600 * 1000).toISOString();
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: "no games in window",
          window: { fromIso, toIso },
        }),
        { headers: { "content-type": "application/json", "cache-control": "no-store" } },
      );
    }

    let matched = 0;
    let updated = 0;

    for (const { season, week } of pairs) {
      // Fetch ESPN for this (season, week)
      const extGames = await fetchEspnScoreboard(season, week);

      // Lookups from ESPN data
      const byEspn = new Map(extGames.map((e) => [e.espn_id, e]));
      const byKey = new Map<string, ExtGame>(); // "HOME-AWAY-ISO"
      for (const e of extGames) {
        const key = `${e.home_abbr || ""}-${e.away_abbr || ""}-${e.start_utc || ""}`;
        byKey.set(key, e);
      }

      // Only the games we need from our DB
      const { data: games, error: gErr } = await supabase
        .from("games")
        .select("id, season, week, game_utc, status, home_team, away_team, home_score, away_score, espn_id")
        .eq("season", season)
        .eq("week", week);
      if (gErr) throw gErr;

      for (const g of games || []) {
        let eg: ExtGame | undefined;

        // 1) espn_id match
        if (g.espn_id && byEspn.has(g.espn_id)) eg = byEspn.get(g.espn_id);

        // 2) fallback: team abbr + kickoff ISO
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
