import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const u = new URL(req.url)
  const leagueId = u.searchParams.get('leagueId')
  const season = Number(u.searchParams.get('season'))
  if (!leagueId || !season) return NextResponse.json({ error: 'leagueId & season required' }, { status: 400 })

  const sb = supabaseServer()
  const { data, error } = await sb
    .from('season_points')
    .select(`
      profile_id, points,
      profiles!inner ( email, display_name )
    `)
    .eq('league_id', leagueId)
    .eq('season', season)
    .order('points', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ standings: data ?? [] })
}
