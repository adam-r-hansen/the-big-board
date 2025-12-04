// app/api/team-records/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const revalidate = 0

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!
  if (!url || !key) throw new Error('Missing Supabase credentials')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * GET /api/team-records?season=2025&week=15
 * Returns team records for a specific season and week
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const season = searchParams.get('season')
    const week = searchParams.get('week')

    if (!season || !week) {
      return NextResponse.json(
        { error: 'season and week are required' },
        { status: 400 }
      )
    }

    const sb = createAdminClient()

    const { data, error } = await sb
      .from('team_records')
      .select('team_id, wins, losses, ties, win_pct')
      .eq('season', Number(season))
      .eq('week', Number(week))

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      season: Number(season),
      week: Number(week),
      records: data || []
    })

  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'server error' },
      { status: 500 }
    )
  }
}
