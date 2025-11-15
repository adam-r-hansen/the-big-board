import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-clients'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'unauthenticated' },
      { status: 401, headers: { 'cache-control': 'no-store' } }
    )
  }

  const body = await req.json().catch(() => ({}))
  const { leagueId, email, role = 'member' } = body

  if (!leagueId || !email) {
    return NextResponse.json(
      { error: 'leagueId and email required' },
      { status: 400, headers: { 'cache-control': 'no-store' } }
    )
  }

  const { data, error } = await supabase
    .from('league_invites')
    .insert({
      league_id: leagueId,
      email,
      role,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { 'cache-control': 'no-store' } }
    )
  }

  return NextResponse.json(
    { ok: true, invite: data },
    { headers: { 'cache-control': 'no-store' } }
  )
}
