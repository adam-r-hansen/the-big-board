import { NextRequest, NextResponse } from 'next/server'
import { cookies as nextCookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

type Row = {
  pickId: string
  profileId: string
  name: string
  team: {
    id: string
    abbreviation: string | null
    short_name: string | null
    name: string | null
    color_primary: string | null
    color_secondary: string | null
  } | null
  gameUtc: string | null
  status: string | null
}

function safeName(display?: string | null, email?: string | null) {
  if (display && display.trim()) return display.trim()
  if (email) return email.split('@')[0]
  return 'Unknown'
}

/** Next 15 can type cookies() as Promise<ReadonlyRequestCookies>. Handle both. */
async function getCookieStore() {
  const maybe = (nextCookies as any)()
  if (typeof maybe?.get === 'function') return maybe
  return await maybe
}

export async function GET(req: NextRequest) {
  const urlObj = new URL(req.url)
  const leagueId = urlObj.searchParams.get('leagueId')
  const seasonStr = urlObj.searchParams.get('season')
  const weekStr = urlObj.searchParams.get('week')

  if (!leagueId || !seasonStr || !weekStr) {
    return NextResponse.json(
      { error: 'leagueId, season, week are required' },
      { status: 400 },
    )
  }

  const season = Number(seasonStr)
  const week = Number(weekStr)
  if (!Number.isFinite(season) || !Number.isFinite(week)) {
    return NextResponse.json({ error: 'invalid season/week' }, { status: 400 })
  }

  // Build the Supabase server client inside the handler (no import-time env reads)
  const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { error: 'Supabase env not configured (URL/ANON KEY missing)' },
      { status: 500 },
    )
  }

  const cookieStore = await getCookieStore()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        cookieStore.set(name, value, options)
      },
      remove(name: string, options: any) {
        cookieStore.set(name, '', { ...options, maxAge: 0 })
      },
    },
  })

  // 1) Picks (minimal)
  const { data: picks, error: picksErr } = await supabase
    .from('picks')
    .select('id, profile_id, team_id, game_id')
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('week', week)

  if (picksErr) return NextResponse.json({ error: picksErr.message }, { status: 500 })

  const validPicks = (picks ?? []).filter(p => p.game_id)
  if (validPicks.length === 0) return NextResponse.json({ rows: [] })

  // 2) Games (determine locked)
  const gameIds = Array.from(new Set(validPicks.map(p => p.game_id as string)))
  const { data: games, error: gamesErr } = await supabase
    .from('games')
    .select('id, game_utc, status')
    .in('id', gameIds)

  if (gamesErr) return NextResponse.json({ error: gamesErr.message }, { status: 500 })

  const nowMs = Date.now()
  const byGame = new Map((games ?? []).map(g => [g.id, g]))
  const isLocked = (g: { game_utc: string | null; status: string | null }) => {
    const st = (g?.status ?? '').toUpperCase()
    if (st === 'LIVE' || st === 'FINAL') return true
    const k = g?.game_utc ? Date.parse(String(g.game_utc)) : NaN
    return Number.isFinite(k) && nowMs >= k
  }
  const locked = validPicks.filter(p => {
    const g = byGame.get(p.game_id as string)
    return g ? isLocked(g as any) : false
  })
  if (locked.length === 0) return NextResponse.json({ rows: [] })

  // 3) Profiles (display_name/email; there is no full_name in your table)
  const profileIds = Array.from(new Set(locked.map(p => p.profile_id as string)))
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, display_name, email')
    .in('id', profileIds)

  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 })

  const byProfile = new Map((profiles ?? []).map(pr => [pr.id, pr]))

  // 4) Teams (public-read)
  const teamIds = Array.from(new Set(locked.map(p => p.team_id as string)))
  const { data: teams, error: teamsErr } = await supabase
    .from('teams')
    .select('id, abbreviation, short_name, name, color_primary, color_secondary')
    .in('id', teamIds)

  if (teamsErr) return NextResponse.json({ error: teamsErr.message }, { status: 500 })

  const byTeam = new Map((teams ?? []).map(t => [t.id, t]))

  // Compose rows
  const rows: Row[] = locked.map(p => {
    const g = byGame.get(p.game_id as string) as any
    const pr = byProfile.get(p.profile_id as string) as any
    const t = byTeam.get(p.team_id as string) as any
    return {
      pickId: p.id as string,
      profileId: p.profile_id as string,
      name: safeName(pr?.display_name ?? null, pr?.email ?? null),
      team: t
        ? {
            id: t.id as string,
            abbreviation: t.abbreviation ?? null,
            short_name: t.short_name ?? null,
            name: t.name ?? null,
            color_primary: t.color_primary ?? null,
            color_secondary: t.color_secondary ?? null,
          }
        : null,
      gameUtc: g?.game_utc ?? null,
      status: g?.status ?? null,
    }
  })

  rows.sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      (a.team?.short_name ?? '').localeCompare(b.team?.short_name ?? ''),
  )

  return NextResponse.json({ rows })
}
