import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { profileId, leagueId, role } = await req.json().catch(() => ({}))

  if (!profileId || !leagueId) {
    return NextResponse.json({ error: 'profileId and leagueId are required' }, { status: 400 })
  }

  // Already a member?
  const { data: existing, error: existErr } = await supabase
    .from('league_memberships')
    .select('id')
    .eq('league_id', leagueId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (existErr) return NextResponse.json({ error: existErr.message }, { status: 500 })
  if (existing) return NextResponse.json({ ok: true, alreadyMember: true })

  const { error } = await supabase
    .from('league_memberships')
    .insert([{ league_id: leagueId, profile_id: profileId, role: role || 'member' }])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
