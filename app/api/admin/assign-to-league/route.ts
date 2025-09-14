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

  // Idempotent upsert: if your schema enforces unique (league_id, profile_id) you can use upsert.
  const { error } = await supabase
    .from('league_members')
    .upsert({ league_id: leagueId, profile_id: profileId }, { onConflict: 'league_id,profile_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
