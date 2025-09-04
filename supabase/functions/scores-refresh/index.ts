// supabase/functions/scores-refresh/index.ts
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ESPN_URL =
  Deno.env.get("ESPN_SCOREBOARD_URL") ??
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"; // public

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
  // seasontype=2 => regular season
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

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const season = Number(url.searchParams.get("season") || new Date().getFullYear());
    const week = url.searchParams.get("week") ? Number(url.searchParams.get("week")) : undefined;

    // Load team abbreviations for mapping (abbr -> team.id)
    const { data: teams, error: tErr } = await supabase.from("teams").select("id, abbreviation");
    if (tErr) throw tErr;
    const abbrToId = new Map<string, string>();
    (teams || []).forEach((t: any) => {
      if (t?.abbreviation && t?.id) abbrToId.set(String(t.abbreviation).toUpperCase(), t.id);
    });

    // Pull our DB games for the selected season (and optional week)
    let gq = supabase
      .from("games")
      .select("id, season, week, game_utc, status, home_team, away_team, home_score, away_score, espn_id")
      .eq("season", season)
      .order("week", { ascending: true });
    if (typeof week === "number") gq = gq.eq("week", week);
    const { data: games, error: gErr } = await gq;
    if (gErr) throw gErr;

    // Figure which weeks to fetch from ESPN
    const weeksToFetch =
      typeof week === "number"
        ? [week]
        : Array.from(new Set((games || []).map((g: any) => g.week).filter((n: any) => typeof n === "number")));

    let matched = 0;
    let updated = 0;

    for (const wk of weeksToFetch) {
      const extGames = await fetchEspnScoreboard(season, wk);

      // Build lookups
      const byEspn = new Map(extGames.map((e) => [e.espn_id, e]));
      const byKey = new Map<string, ExtGame>(); // "HOME-AWAY-ISO"
      for (const e of extGames) {
        const key = `${e.home_abbr || ""}-${e.away_abbr || ""}-${e.start_utc || ""}`;
        byKey.set(key, e);
      }

      const ours = (games || []).filter((g: any) => g.week === wk);
      for (const g of ours) {
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

    return new Response(JSON.stringify({ ok: true, season, week, matched, updated }), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
});
