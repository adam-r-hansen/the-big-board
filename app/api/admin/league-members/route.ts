import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId') || ''

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 401 })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!leagueId) return NextResponse.json({ error: 'leagueId required' }, { status: 400 })

  // join league_members -> profiles for display_name/email
  const { data, error } = await supabase
    .from('league_members')
    .select('profile_id, profiles:profiles(id, email, display_name)')
    .eq('league_id', leagueId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Cast to any[] so TS doesn't infer a weird union/tuple
  const rows = (data as any[]) ?? []
  const members = rows.map((r: any) => ({
    id: r?.profiles?.id ?? r?.profile_id,
    email: r?.profiles?.email ?? null,
    display_name: r?.profiles?.display_name ?? null,
  }))

  return NextResponse.json({ members })
}
