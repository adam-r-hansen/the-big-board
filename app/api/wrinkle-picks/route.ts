// app/api/wrinkle-picks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function j(data: any, init?: number | ResponseInit) {
  const base: ResponseInit = typeof init === 'number' ? { status: init } : init || {}
  const headers = new Headers(base.headers)
  headers.set('Cache-Control', 'no-store')
  return NextResponse.json(data, { ...base, headers })
}

// Try querying wrinke_picks (legacy) first; if error, fall back to wrinkle_picks
async function safeSelectPicks(admin: any, profileId: string, leagueId: string, season: number, week: number) {
  try {
    const { data, error } = await admin
      .from('wrinke_picks')
      .select('id, wrinkle_id, profile_id, team_id, game_id')
      .eq('profile_id', profileId)
      .eq('league_id', leagueId)
      .eq('season', season)
      .eq('week', week)
      .order('id', { ascending: true })
    if (error) throw error
    return { data }
  } catch {
    const { data, error } = await admin
      .from('wrinkle_picks')
      .select('id, wrinkle_id, profile_id, team_id, game_id')
      .eq('profile_id', profileId)
      .eq('league_id', leagueId)
      .eq('season', season)
      .eq('week', week)
      .order('id', { ascending: true })
    if (error) throw error
    return { data }
  }
}

async function safeUpsertPick(admin: any, row: any) {
  // Delete existing pick for this wrinkle/profile, then insert
  try {
    const { error: delErr } = await admin
      .from('wrinke_picks')
      .delete()
      .eq('wrinkle_id', row.wrinkle_id)
      .eq('profile_id', row.profile_id)
    // ignore delErr — table may not exist
  } catch {}
  try {
    const { error: delErr2 } = await admin
      .from('wrinkle_picks')
      .delete()
      .eq('wrinkle_id', row.wrinkle_id)
      .eq('profile_id', row.profile_id)
    // ignore
  } catch {}

  // Try legacy table first
  try {
    const { data, error } = await admin
      .from('wrinke_picks')
      .insert(row)
      .select('id')
      .single()
    if (error) throw error
    return { id: data?.id }
  } catch {
    const { data, error } = await admin
      .from('wrinkle_picks')
      .insert(row)
      .select('id')
      .single()
    if (error) throw error
    return { id: data?.id }
  }
}

async function isLocked(admin: any, wrinkleId: string): Promise<{ locked: boolean; why?: string }> {
  // Check attached wrinkle game kickoff/status
  const { data: g } = await admin
    .from('wrinkle_games')
    .select('game_utc, status')
    .eq('wrinkle_id', wrinkleId)
    .maybeSingle()

  const utc = g?.game_utc as string | undefined
  const status = (g?.status || '').toUpperCase()
  if (status === 'FINAL') return { locked: true, why: 'locked (final)' }
  if (utc && new Date(utc) <= new Date()) return { locked: true, why: 'locked (kickoff passed)' }
  return { locked: false }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth?.user) return j({ error: 'unauthenticated' }, 401)

  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId') || ''
  const season = Number(searchParams.get('season') || '0')
  const week = Number(searchParams.get('week') || '0')
  if (!leagueId || !season || !week) return j({ error: 'leagueId, season, week required' }, 400)

  const admin = createAdminClient()

  // (Optional) ensure league membership
  const { data: mem } = await admin
    .from('league_memberships')
    .select('profile_id')
    .eq('league_id', leagueId)
    .eq('profile_id', auth.user.id)
    .maybeSingle()
  if (!mem) return j({ picks: [] }, 200)

  const { data } = await safeSelectPicks(admin, auth.user.id, leagueId, season, week)
  return j({ picks: data ?? [] }, 200)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth?.user) return j({ error: 'unauthenticated' }, 401)

  let body: any = {}
  try { body = await req.json() } catch {}
  const leagueId = body.leagueId as string
  const season = Number(body.season)
  const week = Number(body.week)
  const wrinkleId = body.wrinkleId as string
  const teamId = body.teamId as string | null | undefined
  const gameId = (body.gameId as string | null | undefined) ?? null

  if (!leagueId || !season || !week || !wrinkleId || !teamId) {
    return j({ error: 'leagueId, season, week, wrinkleId, teamId required' }, 400)
  }

  const admin = createAdminClient()

  // (Optional) ensure membership
  const { data: mem } = await admin
    .from('league_memberships')
    .select('profile_id')
    .eq('league_id', leagueId)
    .eq('profile_id', auth.user.id)
    .maybeSingle()
  if (!mem) return j({ error: 'forbidden' }, 403)

  // Lock check
  const lock = await isLocked(admin, wrinkleId)
  if (lock.locked) return j({ error: lock.why }, 400)

  const row = {
    league_id: leagueId,
    season,
    week,
    wrinkle_id: wrinkleId,
    profile_id: auth.user.id,
    team_id: teamId,
    game_id: gameId,
  }

  const { id } = await safeUpsertPick(admin, row)
  return j({ ok: true, id }, 200)
}
