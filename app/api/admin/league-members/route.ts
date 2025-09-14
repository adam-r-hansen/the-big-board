import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId') || ''

  if (!leagueId) return NextResponse.json({ error: 'leagueId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('league_memberships')
    .select('profile_id, profiles:profiles(id, email, display_name)')
    .eq('league_id', leagueId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const members = ((data as any[]) ?? []).map(r => ({
    id: r?.profiles?.id ?? r?.profile_id,
    email: r?.profiles?.email ?? null,
    display_name: r?.profiles?.display_name ?? null,
  }))

  return NextResponse.json({ members })
}
