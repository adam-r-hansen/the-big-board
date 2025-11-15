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
  const { token } = body

  if (!token) {
    return NextResponse.json(
      { error: 'token required' },
      { status: 400, headers: { 'cache-control': 'no-store' } }
    )
  }

  const { data: invite, error: inviteError } = await supabase
    .from('league_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (inviteError || !invite) {
    return NextResponse.json(
      { error: 'invalid invite' },
      { status: 404, headers: { 'cache-control': 'no-store' } }
    )
  }

  const { error: memberError } = await supabase
    .from('league_members')
    .insert({
      league_id: invite.league_id,
      profile_id: user.id,
      role: invite.role || 'member',
    })

  if (memberError) {
    return NextResponse.json(
      { error: memberError.message },
      { status: 500, headers: { 'cache-control': 'no-store' } }
    )
  }

  await supabase.from('league_invites').delete().eq('token', token)

  return NextResponse.json(
    { ok: true },
    { headers: { 'cache-control': 'no-store' } }
  )
}
