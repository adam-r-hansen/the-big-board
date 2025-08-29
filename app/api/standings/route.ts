import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE
  if (!url || !key) throw new Error('Supabase URL or service role key missing')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const leagueId = searchParams.get('leagueId')!
    const season = Number(searchParams.get('season') || '0')
    if (!leagueId || !season) {
      return NextResponse.json({ error: 'leagueId & season required' }, { status: 400 })
    }

    const sb = supabaseServer()
    // If you don't have a view yet, swap this for your SELECT/JOIN.
    const { data, error } = await sb
      .from('standings_view')
      .select('profile_id, points, profiles(display_name, email)')
      .eq('league_id', leagueId)
      .eq('season', season)
      .order('points', { ascending: false })

    if (error) throw error
    return NextResponse.json({ standings: data ?? [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 })
  }
}

