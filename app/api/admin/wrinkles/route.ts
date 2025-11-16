// app/api/admin/wrinkles/route.ts
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

async function getClient() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  return { supabase, user: data?.user ?? null, error }
}

// GET: Fetch wrinkles
export async function GET(req: NextRequest) {
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId')
  const season = searchParams.get('season')
  const week = searchParams.get('week')

  if (!leagueId) {
    return j({ error: 'leagueId required' }, 400)
  }

  let query = supabase
    .from('wrinkles')
    .select('*')
    .eq('league_id', leagueId)

  if (season) query = query.eq('season', parseInt(season))
  if (week) query = query.eq('week', parseInt(week))

  const { data, error: fetchError } = await query.order('week', { ascending: false })

  if (fetchError) {
    return j({ error: fetchError.message }, 400)
  }

  return j({ wrinkles: data || [] })
}

// POST: Create wrinkle
export async function POST(req: NextRequest) {
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  let body: any = {}
  try {
    body = await req.json()
  } catch {}

  const { leagueId, season, week, name, status, kind, extraPicks, autoHydrate } = body

  if (!leagueId || !season || !week || !name || !kind) {
    return j({ error: 'leagueId, season, week, name, and kind required' }, 400)
  }

  try {
    // Create wrinkle
    const { data: wrinkle, error: createError } = await supabase
      .from('wrinkles')
      .insert({
        league_id: leagueId,
        season,
        week,
        name,
        status: status || 'active',
        kind,
        extra_picks: extraPicks || 0,
        config: {},
        created_by: user.id,
      })
      .select()
      .single()

    if (createError) throw new Error(createError.message)

    // Auto-hydrate for winless double
    if (autoHydrate && kind === 'winless_double') {
      // Get team records for this week
      const { data: records, error: recordsError } = await supabase
        .from('team_records')
        .select('team_id, wins')
        .eq('season', season)
        .eq('week', week)
        .eq('wins', 0)

      if (recordsError) {
        console.error('Failed to fetch team records:', recordsError)
      } else if (records && records.length > 0) {
        const winlessTeamIds = records.map(r => r.team_id)

        // Update wrinkle config with winless teams
        await supabase
          .from('wrinkles')
          .update({
            config: { winless_teams: winlessTeamIds }
          })
          .eq('id', wrinkle.id)

        // Update existing picks to mark winless_double = true
        await supabase
          .from('picks')
          .update({ winless_double: true })
          .eq('league_id', leagueId)
          .eq('season', season)
          .eq('week', week)
          .in('team_id', winlessTeamIds)
      }
    }

    return j({ ok: true, wrinkle })
  } catch (err: any) {
    console.error('Create wrinkle error:', err)
    return j({ error: err?.message || 'Failed to create wrinkle' }, 500)
  }
}
