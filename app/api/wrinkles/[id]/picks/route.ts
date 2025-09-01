// app/api/wrinkles/[id]/picks/route.ts
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/clients'
import { getTeamRecordUpTo } from '@/lib/wrinkles'

export const runtime = 'nodejs'
export const revalidate = 0

function jsonNoStore(data: any, init: ResponseInit = {}) {
  const h = new Headers(init.headers)
  h.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  h.set('Pragma', 'no-cache')
  h.set('Expires', '0')
  h.set('Surrogate-Control', 'no-store')
  return new Response(JSON.stringify(data), {
    ...init,
    headers: h,
    status: init.status ?? 200,
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: wrinkleId } = await params
  const { leagueId, season, week, teamId, gameId } = await req.json()

  if (!wrinkleId || !leagueId || !season || !week || !teamId || !gameId) {
    return jsonNoStore({ error: 'missing params' }, { status: 400 })
  }

  const sb = await createServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return jsonNoStore({ error: 'not signed in' }, { status: 401 })

  // Load wrinkle (get kind)
  const { data: wrArr, error: wErr } = await sb
    .from('wrinkles')
    .select('id, league_id, season, week, status, kind, config')
    .eq('id', wrinkleId)
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('week', week)
    .limit(1)
  if (wErr || !wrArr?.[0]) return jsonNoStore({ error: 'wrinkle not found' }, { status: 404 })
  const wrinkle = wrArr[0]
  const kind = String(wrinkle.kind ?? 'bonus_game').toLowerCase()

  // Kickoff guard
  const { data: gArr } = await sb.from('games').select('id, game_utc').eq('id', gameId).limit(1)
  const kickoff = gArr?.[0]?.game_utc ? new Date(gArr[0].game_utc) : null
  if (!kickoff) return jsonNoStore({ error: 'game not found' }, { status: 404 })
  if (new Date() >= kickoff) return jsonNoStore({ error: 'locked (kickoff passed)' }, { status: 400 })

  // OOF: team win% must be < .400 at pick time
  if (kind === 'bonus_game_oof') {
    const { wins, losses } = await getTeamRecordUpTo(sb, season, kickoff.toISOString(), teamId)
    const total = wins + losses
    const pct = total > 0 ? wins / total : 0
    if (pct >= 0.4) {
      return jsonNoStore({ error: 'team not eligible (>= .400)' }, { status: 400 })
    }
  }

  // Only one bonus pick per wrinkle per user
  const profileId = user.id
  const { data: existing, error: exErr } = await sb
    .from('wrinkle_picks')
    .select('id', { count: 'exact' })
    .eq('wrinkle_id', wrinkleId)
    .eq('profile_id', profileId)
    .limit(1)
  if (exErr) return jsonNoStore({ error: exErr.message }, { status: 500 })
  if ((existing?.length ?? 0) > 0) return jsonNoStore({ error: 'already picked' }, { status: 400 })

  const { error: insErr } = await sb
    .from('wrinkle_picks')
    .insert({ wrinkle_id: wrinkleId, profile_id: profileId, team_id: teamId, game_id: gameId })
  if (insErr) return jsonNoStore({ error: insErr.message }, { status: 500 })

  return jsonNoStore({ ok: true })
}
