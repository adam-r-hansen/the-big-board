// app/api/wrinkles/active/route.ts
import { NextResponse } from 'next/server'

// Prefer the server-side Supabase helper if you have it.
// If your project uses a different path/name, adjust this import.
// The key point: we will *await* the factory so we don't get a Promise.
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server'

type WrinkleRow = {
  id: string
  league_id: string
  season: number
  week: number
  name?: string | null
  status?: string | null
  created_by?: string | null
  created_at?: string | null
  extra_picks?: number | null
  kind?: string | null
  config?: string | null
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const leagueId = url.searchParams.get('leagueId') || url.searchParams.get('league_id') || ''
    const season = Number(url.searchParams.get('season') || '')
    const week = Number(url.searchParams.get('week') || '')

    if (!leagueId || !season || !week) {
      return NextResponse.json(
        { error: 'Missing required query params: leagueId, season, week' },
        { status: 400 }
      )
    }

    // IMPORTANT: await the client factory
    const supabase = await createSupabaseServerClient()

    // Fetch active wrinkles for the exact league/season/week
    const { data: wrinkleRows, error: wrErr } = await supabase
      .from('wrinkles')
      .select('*')
      .eq('league_id', leagueId)
      .eq('season', season)
      .eq('week', week)
      .eq('status', 'active')
      .order('created_at', { ascending: true })

    if (wrErr) {
      return NextResponse.json({ error: wrErr.message }, { status: 500 })
    }

    const wrinkles: WrinkleRow[] = Array.isArray(wrinkleRows) ? wrinkleRows : []

    return NextResponse.json({
      wrinkles,
      count: wrinkles.length,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Unexpected error' },
      { status: 500 }
    )
  }
}
