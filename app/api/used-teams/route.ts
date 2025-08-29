// app/api/used-teams/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId') ?? ''
  const season = Number(searchParams.get('season') ?? '0')

  if (!leagueId || !season) {
    return NextResponse.json({ error: 'leagueId and season required' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { get: (n)=>cookieStore.get(n)?.value, set: (n,v,o)=>cookieStore.set({ name:n, value:v, ...o }), remove: (n,o)=>cookieStore.set({ name:n, value:'', maxAge:0, ...o }) } }
  )

  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return NextResponse.json({ teams: [] })

  const { data, error } = await supabase
    .from('picks')
    .select('team_id')
    .eq('league_id', leagueId)
    .eq('profile_id', user.user.id)
    .eq('season', season)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const teams = [...new Set((data ?? []).map(r => r.team_id))]
  return NextResponse.json({ teams })
}

