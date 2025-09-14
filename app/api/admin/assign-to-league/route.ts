import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
  return createServerClient(url, key, {
    cookies: {
      get() { return undefined }, set() {}, remove() {},
    },
  })
}

export async function POST(req: Request) {
  try {
    const { profileId, leagueId, role = 'member' } = await req.json()
    if (!profileId || !leagueId) {
      return NextResponse.json({ error: 'profileId and leagueId required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // already assigned?
    const { data: existing, error: selErr } = await supabase
      .from('league_memberships')
      .select('id')
      .eq('profile_id', profileId)
      .eq('league_id', leagueId)
      .limit(1)
      .maybeSingle()
    if (selErr) throw selErr
    if (existing) {
      return NextResponse.json({ ok: true, already: true, id: existing.id })
    }

    // insert (RLS bypassed via service-role)
    const { data, error } = await supabase
      .from('league_memberships')
      .insert([{ profile_id: profileId, league_id: leagueId, role }])
      .select('id')
      .single()
    if (error) throw error

    return NextResponse.json({ ok: true, id: data.id })
  } catch (e: any) {
    console.error('assign-to-league POST failed:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
