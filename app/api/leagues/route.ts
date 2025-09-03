// app/api/leagues/route.ts
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

async function client() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  return { supabase, user: data?.user ?? null, error }
}

/**
 * GET /api/leagues
 * Simple reader for leagues. (Admin page primarily uses /api/my-leagues.)
 */
export async function GET() {
  const { supabase, user, error } = await client()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  const { data, error: dbErr } = await supabase
    .from('leagues')
    .select('id, name, season, created_at')
    .order('created_at', { ascending: false })

  if (dbErr) return j({ error: dbErr.message }, 400)
  return j({ leagues: data ?? [] }, 200)
}

/**
 * POST /api/leagues
 * Body: { name: string, season: number }
 * Inserts only the columns your table actually has (name, season).
 */
export async function POST(req: NextRequest) {
  const { supabase, user, error } = await client()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  let body: any = {}
  try { body = await req.json() } catch {}

  const name = (body?.name || '').trim()
  const season = Number(body?.season || 0)

  if (!name || !season) return j({ error: 'name and season required' }, 400)

  const { data, error: insErr } = await supabase
    .from('leagues')
    .insert({ name, season })
    .select('id')
    .single()

  if (insErr) return j({ error: insErr.message }, 400)
  return j({ ok: true, id: data?.id }, 200)
}
