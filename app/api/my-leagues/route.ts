// app/api/my-leagues/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type MemberRow = { league_id: string; role?: string | null }
type LeagueRow = { id: string; name: string | null; season: number | null }

function noStoreJson(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  headers.set('pragma', 'no-cache')
  headers.set('expires', '0')
  headers.set('surrogate-control', 'no-store')
  return new NextResponse(JSON.stringify(data), { ...init, headers, status: init.status ?? 200 })
}

export async function GET() {
  const sb = await createClient()

  // Auth
  const { data: auth } = await sb.auth.getUser()
  const user = auth?.user
  if (!user) {
    return noStoreJson({ error: 'unauthenticated' }, { status: 401 })
  }

  // Member rows for this profile
  const { data: mems, error: memErr } = await sb
    .from('league_members')
    .select('league_id, role')
    .eq('profile_id', user.id)

  if (memErr) {
    return noStoreJson({ error: memErr.message }, { status: 500 })
  }

  const leagueIds: string[] = Array.from(
    new Set((mems ?? []).map((r: MemberRow) => r.league_id).filter(Boolean) as string[])
  )

  if (leagueIds.length === 0) {
    return noStoreJson({ leagues: [] })
  }

  // Fetch leagues by id
  const { data: leagues, error: lgErr } = await sb
    .from('leagues')
    .select('id, name, season')
    .in('id', leagueIds)

  if (lgErr) {
    return noStoreJson({ error: lgErr.message }, { status: 500 })
  }

  // Join role back onto each league (helpful for client UIs)
  const roleByLeague = new Map<string, string | null>()
  for (const m of mems as MemberRow[]) {
    roleByLeague.set(m.league_id, m.role ?? null)
  }

  const payload = (leagues ?? []).map((l: LeagueRow) => ({
    id: l.id,
    name: l.name ?? '',
    season: Number.isFinite(l.season as number) ? (l.season as number) : null,
    role: roleByLeague.get(l.id) ?? null,
  }))

  return noStoreJson({ leagues: payload })
}

// Optional: preserve POST if your client calls it the same as GET
export async function POST() {
  return GET()
}
