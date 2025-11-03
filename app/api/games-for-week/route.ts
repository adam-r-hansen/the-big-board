// app/api/games-for-week/route.ts
import { NextRequest, NextResponse } from 'next/server'
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

/**
 * Returns games for a given season & week with the exact fields
 * the UI expects for rendering scores:
 *   id, season, week, game_utc, status,
 *   home_team, away_team, home_score, away_score
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const season = Number(searchParams.get('season') || '0')
    const week = Number(searchParams.get('week') || '0')

    if (!season || !week) {
      return j({ error: 'season and week are required' }, 400)
    }

    const admin = createAdminClient()

    // Select ONLY the columns the UI reads, including scores.
    const { data, error } = await admin
      .from('games')
      .select(
        [
          'id',
          'season',
          'week',
          'game_utc',
          'status',
          'home_team',
          'away_team',
          'home_score',
          'away_score',
        ].join(', ')
      )
      .eq('season', season)
      .eq('week', week)
      .order('game_utc', { ascending: true })

    if (error) return j({ error: error.message }, 400)

    // Normalize keys the frontend maps over (no renames here)
    const games = (data ?? []).map((g: any) => ({
      id: g.id,
      season: g.season,
      week: g.week,
      game_utc: g.game_utc, // ISO string from DB
      status: (g.status || '').toUpperCase(), // e.g., FINAL / UPCOMING
      home_team: g.home_team,
      away_team: g.away_team,
      home_score: g.home_score ?? null,
      away_score: g.away_score ?? null,
    }))

    return j({ games }, 200)
  } catch (e: any) {
    return j({ error: e?.message || 'server error' }, 500)
  }
}

