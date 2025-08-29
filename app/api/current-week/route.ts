import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE
  if (!url || !key) throw new Error('Supabase URL or service role key missing')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET() {
  try {
    const sb = service()
    const now = new Date().toISOString()

    // First upcoming or in-progress game
    const upcoming = await sb
      .from('games')
      .select('season, week, game_utc')
      .gte('game_utc', now)
      .order('game_utc', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (upcoming.data) {
      return NextResponse.json({ season: upcoming.data.season, week: upcoming.data.week })
    }

    // Otherwise, latest game in DB (fallback)
    const latest = await sb
      .from('games')
      .select('season, week, game_utc')
      .order('game_utc', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latest.data) {
      return NextResponse.json({ season: latest.data.season, week: latest.data.week })
    }

    // If DB empty, default to current year, week 1
    return NextResponse.json({ season: new Date().getFullYear(), week: 1 })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 })
  }
}
