import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 401 })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { profileId, leagueId } = await req.json().catch(() => ({}))
  if (!profileId || !leagueId) {
    return NextResponse.json({ error: 'profileId and leagueId required' }, { status: 400 })
  }

  // already a member?
  const { data: exists, error: chkErr } = await supabase
    .from('league_members')
    .select('id')
    .eq('league_id', leagueId)
    .eq('profile_id', profileId)
    .maybeSingle()
  if (chkErr) return NextResponse.json({ error: chkErr.message }, { status: 500 })
  if (exists) return NextResponse.json({ ok: true, alreadyMember: true })

  const { error } = await supabase
    .from('league_members')
    .insert({ league_id: leagueId, profile_id: profileId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
