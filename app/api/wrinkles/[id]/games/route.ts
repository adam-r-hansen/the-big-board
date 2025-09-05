// app/api/wrinkles/[id]/games/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Always re-fetch; wrinkle pane needs live status
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id: wrinkleId } = await ctx.params
  const supabase = await createClient()

  // Pull wrinkle_games and hydrate from linked games (live truth)
  const { data, error } = await supabase
    .from('wrinkle_games')
    .select(`
      id,
      wrinkle_id,
      game_id,
      home_team,
      away_team,
      game_utc,
      status,
      games:game_id (
        id,
        home_team,
        away_team,
        game_utc,
        status,
        home_score,
        away_score
      )
    `)
    .eq('wrinkle_id', wrinkleId)

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { 'cache-control': 'no-store' } }
    )
  }

  const rows = (data ?? []).map((r: any) => {
    const g = r.games || {}
    return {
      id: r.id,
      game_id: r.game_id || g.id || null,
      // prefer truth from games; fall back to denorm columns
      home_team: r.home_team ?? g.home_team ?? null,
      away_team: r.away_team ?? g.away_team ?? null,
      game_utc: r.game_utc ?? g.game_utc ?? null,
      status: g.status ?? r.status ?? null,
      // optional — handy for UI badges
      home_score: g.home_score ?? null,
      away_score: g.away_score ?? null,
    }
  })

  return NextResponse.json(
    { rows },
    { headers: { 'cache-control': 'no-store' } }
  )
}
