// app/api/admin/wrinkles/[id]/hydrate-oof/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const revalidate = 0

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      pragma: 'no-cache',
    },
  })
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!
  if (!url || !key) throw new Error('Missing Supabase credentials')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * POST /api/admin/wrinkles/[id]/hydrate-oof
 * Auto-populates wrinkle_games for OOF wrinkles
 * Finds all games where at least one team has win_pct < 0.400
 * Uses records from the week BEFORE the wrinkle week
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: wrinkleId } = await context.params
    if (!wrinkleId) return json({ error: 'missing wrinkle id' }, 400)

    const sb = createAdminClient()

    // Get wrinkle details
    const { data: wrinkle, error: wErr } = await sb
      .from('wrinkles')
      .select('season, week, league_id')
      .eq('id', wrinkleId)
      .single()

    if (wErr || !wrinkle) {
      return json({ error: wErr?.message || 'wrinkle not found' }, 404)
    }

    const { season, week, league_id } = wrinkle
    const recordsWeek = week - 1 // Use previous week's records

    if (recordsWeek < 1) {
      return json({ error: 'Cannot use Week 0 records for Week 1 wrinkle' }, 400)
    }

    // Get all games for this week
    const { data: games, error: gErr } = await sb
      .from('games')
      .select('id, game_utc, home_team, away_team')
      .eq('season', season)
      .eq('week', week)

    if (gErr) {
      return json({ error: gErr.message, hint: 'failed to fetch games' }, 500)
    }

    if (!games || games.length === 0) {
      return json({ 
        ok: true, 
        note: 'no games found for this week', 
        qualifying_games: 0 
      })
    }

    // Get team records from previous week
    const { data: records, error: rErr } = await sb
      .from('team_records')
      .select('team_id, win_pct')
      .eq('season', season)
      .eq('week', recordsWeek)

    if (rErr) {
      return json({ error: rErr.message, hint: 'failed to fetch team records' }, 500)
    }

    // Build map of team_id -> win_pct
    const teamRecords = new Map<string, number>()
    for (const r of records || []) {
      if (r.team_id && r.win_pct != null) {
        teamRecords.set(r.team_id, Number(r.win_pct))
      }
    }

    // Find qualifying games (at least one team < .400)
    const qualifyingGames = games.filter(g => {
      const homeWinPct = teamRecords.get(g.home_team) ?? 1.0
      const awayWinPct = teamRecords.get(g.away_team) ?? 1.0
      return homeWinPct < 0.400 || awayWinPct < 0.400
    })

    if (qualifyingGames.length === 0) {
      return json({
        ok: true,
        note: 'no qualifying games (no teams with win_pct < 0.400)',
        total_games: games.length,
        qualifying_games: 0
      })
    }

    // Build wrinkle_games rows
    const rows = qualifyingGames.map(g => ({
      wrinkle_id: wrinkleId,
      game_id: g.id,
      game_utc: g.game_utc,
      home_team: g.home_team,
      away_team: g.away_team,
      spread: null,
    }))

    // Upsert to wrinkle_games
    const { data: upserted, error: uErr } = await sb
      .from('wrinkle_games')
      .upsert(rows, { onConflict: 'wrinkle_id,game_id' })
      .select('id')

    if (uErr) {
      return json({
        error: uErr.message,
        hint: 'upsert into wrinkle_games failed',
        attempted: rows.length,
      }, 500)
    }

    return json({
      ok: true,
      season,
      week,
      records_week: recordsWeek,
      total_games: games.length,
      qualifying_games: qualifyingGames.length,
      upserted: upserted?.length || 0
    })

  } catch (e: any) {
    return json({ error: e?.message || 'server error' }, 500)
  }
}
