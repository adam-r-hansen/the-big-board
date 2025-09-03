// app/api/wrinkles/[id]/games/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> }
async function resolveParams(ctx: Ctx): Promise<{ id: string }> {
  const p: any = (ctx as any).params
  return typeof p?.then === 'function' ? await p : p
}

function j(data: any, init?: number | ResponseInit) {
  const base: ResponseInit = typeof init === 'number' ? { status: init } : init || {}
  const headers = new Headers(base.headers)
  headers.set('Cache-Control', 'no-store')
  return NextResponse.json(data, { ...base, headers })
}

// GET /api/wrinkles/:id/games
// UI expects:
// {
//   "rows": [
//     {
//       "id": "uuid",           // row id
//       "game_id": "uuid",      // the linked game id (preferred; UI hydrates teams if needed)
//       "home_team": "uuid|abbr", // optional
//       "away_team": "uuid|abbr", // optional
//       "game_utc": "ISO",
//       "status": "UPCOMING|FINAL|..."
//     }
//   ]
// }
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await resolveParams(ctx)

  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth?.user) return j({ error: 'unauthenticated' }, 401)

  const { data, error } = await supabase
    .from('wrinkle_games')
    .select('id, wrinkle_id, game_id, home_team, away_team, game_utc, status')
    .eq('wrinkle_id', id)
    .order('game_utc', { ascending: true })

  if (error) return j({ error: error.message }, 400)

  const rows = (data ?? []).map((r: any) => ({
    id: r.id,
    game_id: r.game_id ?? null,
    home_team: r.home_team ?? null,
    away_team: r.away_team ?? null,
    game_utc: r.game_utc ?? null,
    status: r.status ?? null,
  }))

  return j({ rows }, 200)
}

