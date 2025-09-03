// app/api/wrinkles/active/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function j(data: any, init?: number | ResponseInit) {
  const base: ResponseInit = typeof init === 'number' ? { status: init } : init || {}
  const headers = new Headers(base.headers)
  headers.set('Cache-Control', 'no-store')
  return NextResponse.json(data, { ...base, headers })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth?.user) return j({ error: 'unauthenticated' }, 401)

  const sp = new URL(req.url).searchParams
  const leagueId = sp.get('leagueId') || ''
  const season = Number(sp.get('season') || '0')
  const week = Number(sp.get('week') || '0')

  if (!season || !week) return j({ wrinkles: [] }, 200)

  // Return wrinkles scoped to the league, or global (league_id IS NULL)
  // Shape: { id, name, extra_picks, season, week, ... }
  let q = supabase
    .from('wrinkles')
    .select('id, name, extra_picks, season, week, league_id')
    .eq('season', season)
    .eq('week', week)

  if (leagueId) {
    // include league-specific OR global
    q = q.or(`league_id.eq.${leagueId},league_id.is.null`)
  } else {
    // no league provided -> only global
    // @ts-ignore supabase-js supports .is
    q = q.is('league_id', null)
  }

  const { data, error } = await q
  if (error) return j({ error: error.message }, 400)

  // UI contract expects { "wrinkles": [ { id, name, extra_picks, ... } ] }
  return j({ wrinkles: data ?? [] }, 200)
}

