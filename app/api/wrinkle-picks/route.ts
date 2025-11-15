import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-clients'
import { createServerSupabaseClient } from '@/lib/supabase-clients'

export const dynamic = 'force-dynamic'

function noStore(data: any, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...init?.headers, 'cache-control': 'no-store' },
  })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const wrinkleId = url.searchParams.get('wrinkleId')
  const leagueId = url.searchParams.get('leagueId')

  if (!wrinkleId && !leagueId) {
    return noStore({ error: 'wrinkleId or leagueId required' }, { status: 400 })
  }

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()

  if (!user) {
    return noStore({ error: 'unauthenticated' }, { status: 401 })
  }

  const adminSb = createAdminSupabaseClient()
  let query = adminSb.from('wrinkle_picks').select('*')

  if (wrinkleId) {
    query = query.eq('wrinkle_id', wrinkleId)
  }
  if (leagueId) {
    query = query.eq('league_id', leagueId)
  }

  const { data, error } = await query

  if (error) {
    return noStore({ error: error.message }, { status: 500 })
  }

  return noStore({ picks: data ?? [] })
}

export async function POST(req: NextRequest) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()

  if (!user) {
    return noStore({ error: 'unauthenticated' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { wrinkleId, gameId, teamId } = body

  if (!wrinkleId || !gameId || !teamId) {
    return noStore({ error: 'wrinkleId, gameId, teamId required' }, { status: 400 })
  }

  const adminSb = createAdminSupabaseClient()
  const { data, error } = await adminSb
    .from('wrinkle_picks')
    .upsert(
      {
        wrinkle_id: wrinkleId,
        game_id: gameId,
        team_id: teamId,
        profile_id: user.id,
      },
      { onConflict: 'wrinkle_id,profile_id' }
    )
    .select()
    .single()

  if (error) {
    return noStore({ error: error.message }, { status: 500 })
  }

  return noStore({ ok: true, pick: data })
}

export async function DELETE(req: NextRequest) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()

  if (!user) {
    return noStore({ error: 'unauthenticated' }, { status: 401 })
  }

  const url = new URL(req.url)
  const wrinkleId = url.searchParams.get('wrinkleId')

  if (!wrinkleId) {
    return noStore({ error: 'wrinkleId required' }, { status: 400 })
  }

  const adminSb = createAdminSupabaseClient()
  const { error } = await adminSb
    .from('wrinkle_picks')
    .delete()
    .eq('wrinkle_id', wrinkleId)
    .eq('profile_id', user.id)

  if (error) {
    return noStore({ error: error.message }, { status: 500 })
  }

  return noStore({ ok: true })
}
