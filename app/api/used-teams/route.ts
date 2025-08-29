// app/api/used-teams/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server' // <- our SSR-safe helper

export async function GET(request: Request) {
  try {
    // query params: leagueId & season (required)
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')
    const season = Number(searchParams.get('season'))

    if (!leagueId || !season) {
      return NextResponse.json(
        { error: 'leagueId and season are required' },
        { status: 400 }
      )
    }

    const sb = await createClient()

    // who is calling?
    const { data: userRes, error: uErr } = await sb.auth.getUser()
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
    if (!userRes?.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const profileId = userRes.user.id

    // sanity: must be a member of the league
    const { data: lm, error: lmErr } = await sb
      .from('league_members')
      .select('role')
      .eq('league_id', leagueId)
      .eq('profile_id', profileId)
      .maybeSingle()
    if (lmErr) return NextResponse.json({ error: lmErr.message }, { status: 500 })
    if (!lm) return NextResponse.json({ error: 'not a league member' }, { status: 403 })

    // fetch teams already used by this player in this season for this league
    const { data, error } = await sb
      .from('picks')
      .select('team_id')
      .eq('league_id', leagueId)
      .eq('season', season)
      .eq('profile_id', profileId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Return as a Set-friendly list (unique, strings)
    const teamIds = Array.from(new Set((data ?? []).map(r => r.team_id as string)))

    return NextResponse.json({ teamIds })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}

