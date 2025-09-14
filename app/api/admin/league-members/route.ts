import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId') || ''
  if (!leagueId) return NextResponse.json({ error: 'leagueId required' }, { status: 400 })

  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('league_members')
    .select('profile_id, profiles(id, email, display_name)')
    .eq('league_id', leagueId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const members = (data || []).map((r: any) => ({
    id: r.profiles?.id ?? r.profile_id,
    email: r.profiles?.email ?? null,
    display_name: r.profiles?.display_name ?? null,
  }))
  return NextResponse.json({ members })
}
