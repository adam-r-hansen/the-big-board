import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()

  // auth guard (optional: tighten to admins later)
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 401 })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // get all profile_ids that *appear* in league_members
  const { data: lm, error: lmErr } = await supabase
    .from('league_members')
    .select('profile_id')
  if (lmErr) return NextResponse.json({ error: lmErr.message }, { status: 500 })

  const assigned = new Set((lm ?? []).map(r => r.profile_id as string))

  // fetch all profiles, then filter out any that are assigned
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, email, display_name')
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const rows = (profiles ?? [])
    .filter(p => !assigned.has(p.id))
    .map(p => ({ id: p.id, email: p.email, display_name: p.display_name ?? null }))

  return NextResponse.json({ rows })
}
