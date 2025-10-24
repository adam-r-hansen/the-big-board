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

// Read all wrinkle ids for this slate
async function getWrinkleIdsForSlate(admin: any, leagueId: string, season: number, week: number) {
  const { data, error } = await admin
    .from('wrinkles')
    .select('id')
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('week', week)
    .eq('status', 'active')
  if (error) throw error
  return (data ?? []).map((r: any) => r.id as string)
}

// Try querying wrinke_picks (legacy misspelled) first; fall back to wrinkle_picks
async function selectPicksByWrinkleIds(admin: any, profileId: string, wrinkleIds: string[]) {
  if (wrinkleIds.length === 0) return { data: [] as any[] }
  try {
    const { data, error } = await admin
      .from('wrinke_picks')
      .select('id, wrinkle_id, profile_id, team_id, game_id')
      .eq('profile_id', profileId)
      .in('wrinkle_id', wrinkleIds)
      .order('id', { ascending: true })
    if (error) throw error
    return { data }
  } catch {
    const { data, error } = await admin
      .from('wrinkle_picks')
      .select('id, wrinkle_id, profile_id, team_id, game_id')
      .eq('profile_id', profileId)
      .in('wrinkle_id', wrinkleIds)
      .order('id', { ascending: true })
    if (error) throw error
    return { data }
  }
}

async function deleteExistingForWrinkle(admin: any, wrinkleId: string, profileId: string) {
  try { await admin.from('wrinke_picks').delete().eq('wrinkle_id', wrinkleId).eq('profile_id', profileId) } catch {}
  try { await admin.from('wrinkle_picks').delete().eq('wrinkle_id', wrinkleId).eq('profile_id', profileId) } catch {}
}

async function insertPick(admin: any, row: { wrinkle_id: string; profile_id: string; team_id: string; game_id: string | null }) {
  try {
    const { data, error } = await admin.from('wrinke_picks').insert(row).select('id').single()
    if (error) throw error
    return { id: data?.id as string | undefined }
  } catch {
    const { data, error } = await admin.from('wrinkle_picks').insert(row).select('id').single()
    if (error) throw error
    return { id: data?.id as string | undefined }
  }
}

async function isLocked(admin: any, wrinkleId: string): Promise<{ locked: boolean; why?: string }> {
  const { data } = await admin
    .from('wrinkle_games')
    .select('game_utc, status')
    .eq('wrinkle_id', wrinkleId)
    .maybeSingle()
  const utc = data?.game_utc as string | undefined
  const status = (data?.status || '').toUpperCase()
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

  // optional membership gate
  const { data: mem } = await admin
    .from('league_memberships')
    .select('profile_id')
    .eq('league_id', leagueId)
    .eq('profile_id', auth.user.id)
    .maybeSingle()
  if (!mem) return j({ picks: [] }, 200)

  const wrinkleIds = await getWrinkleIdsForSlate(admin, leagueId, season, week)
  const { data: picks } = await selectPicksByWrinkleIds(admin, auth.user.id, wrinkleIds)
  return j({ picks: picks ?? [] }, 200)
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

  // verify wrinkleId belongs to this slate
  const ids = await getWrinkleIdsForSlate(admin, leagueId, season, week)
  if (!ids.includes(wrinkleId)) return j({ error: 'invalid wrinkle for slate' }, 400)

  const lock = await isLocked(admin, wrinkleId)
  if (lock.locked) return j({ error: lock.why }, 400)

  const row = {
    wrinkle_id: wrinkleId,
    profile_id: auth.user.id,
    team_id: teamId,
    game_id: gameId,
  }

  await deleteExistingForWrinkle(admin, wrinkleId, auth.user.id)
  const { id } = await insertPick(admin, row)
  return j({ ok: true, id }, 200)
}
