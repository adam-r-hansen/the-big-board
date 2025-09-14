import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// NOTE: This endpoint is admin-only UI. Use the service role key on the server to bypass RLS safely.
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
  return createServerClient(url, key, {
    cookies: {
      get() { return undefined }, set() {}, remove() {},
    },
  })
}

export async function GET() {
  try {
    const supabase = getAdminClient()

    // Pull minimal columns
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id,email,display_name')
    if (pErr) throw pErr

    const { data: memberships, error: mErr } = await supabase
      .from('league_memberships')
      .select('profile_id')
    if (mErr) throw mErr

    const assigned = new Set<string>((memberships || []).map((m: any) => m.profile_id))
    const rows = (profiles || []).filter((p: any) => !assigned.has(p.id))

    return NextResponse.json({ rows })
  } catch (e: any) {
    console.error('unassigned GET failed:', e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
