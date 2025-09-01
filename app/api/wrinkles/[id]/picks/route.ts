// app/api/wrinkles/[id]/picks/route.ts
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

function jsonNoStore(data: any, init: ResponseInit = {}) {
  const h = new Headers(init.headers)
  h.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  h.set('Pragma', 'no-cache'); h.set('Expires', '0'); h.set('Surrogate-Control', 'no-store')
  return new Response(JSON.stringify(data), { ...init, headers: h, status: init.status ?? 200 })
}
function isLocked(utc: string) { return new Date(utc) <= new Date() }

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: wrinkleId } = await ctx.params
  const sb = createServerClient({ req })
  const body = await req.json().catch(() => ({}))
  const { gameId, teamId } = body || {}
  if (!wrinkleId || !gameId || !teamId) return jsonNoStore({ error: 'wrinkleId, gameId, teamId required' }, { status: 400 })

  // Load wrinkle & quota
  const { data: w, error: wErr } = await sb
    .from('wrinkles')
    .select('id, status, extra_picks')
    .eq('id', wrinkleId)
    .single()
  if (wErr || !w) return jsonNoStore({ error: wErr?.message || 'wrinkle not found' }, { status: 404 })
  if (w.status !== 'active') return jsonNoStore({ error: 'wrinkle not active' }, { status: 400 })

  // Validate game is part of this wrinkle
  const { data: g, error: gErr } = await sb
    .from('wrinkle_games')
    .select('id, game_utc, home_team, away_team, status')
    .eq('id', gameId)
    .eq('wrinkle_id', wrinkleId)
    .single()
  if (gErr || !g) return jsonNoStore({ error: gErr?.message || 'game not in wrinkle' }, { status: 400 })

  if (String(teamId).toUpperCase() !== String(g.home_team).toUpperCase() &&
      String(teamId).toUpperCase() !== String(g.away_team).toUpperCase()) {
    return jsonNoStore({ error: 'team not in this game' }, { status: 400 })
  }
  if (isLocked(g.game_utc)) return jsonNoStore({ error: 'game locked (kickoff passed)' }, { status: 400 })

  // Enforce per-user quota
  const { data: mine, error: mErr } = await sb
    .from('wrinkle_picks')
    .select('id')
    .eq('wrinkle_id', wrinkleId)
  if (mErr) return jsonNoStore({ error: mErr.message }, { status: 500 })
  const myCount = (mine ?? []).length
  if (myCount >= (w.extra_picks ?? 1)) return jsonNoStore({ error: 'wrinkle picks quota reached' }, { status: 400 })

  const { error: insErr } = await sb.from('wrinkle_picks').insert([{
    wrinkle_id: wrinkleId,
    game_id: gameId,
    team_id: teamId
  }])
  if (insErr) return jsonNoStore({ error: insErr.message }, { status: 500 })
  return jsonNoStore({ ok: true })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: wrinkleId } = await ctx.params
  const sb = createServerClient({ req })
  const { searchParams } = new URL(req.url)
  const pickId = searchParams.get('id') || ''
  if (!pickId) return jsonNoStore({ error: 'id required' }, { status: 400 })

  // Load pick + game to verify lock
  const { data: p, error: pErr } = await sb
    .from('wrinkle_picks')
    .select('id, game_id')
    .eq('id', pickId)
    .eq('wrinkle_id', wrinkleId)
    .single()
  if (pErr || !p) return jsonNoStore({ error: pErr?.message || 'pick not found' }, { status: 404 })

  const { data: g, error: gErr } = await sb
    .from('wrinkle_games')
    .select('id, game_utc')
    .eq('id', p.game_id)
    .eq('wrinkle_id', wrinkleId)
    .single()
  if (gErr || !g) return jsonNoStore({ error: gErr?.message || 'game not found' }, { status: 400 })
  if (isLocked(g.game_utc)) return jsonNoStore({ error: 'game locked (kickoff passed)' }, { status: 400 })

  const { error: dErr } = await sb.from('wrinkle_picks').delete().eq('id', pickId)
  if (dErr) return jsonNoStore({ error: dErr.message }, { status: 500 })
  return jsonNoStore({ ok: true })
}
