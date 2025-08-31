import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

function json(data: any, init: ResponseInit = {}) {
  const h = new Headers(init.headers)
  h.set('cache-control','no-store, no-cache, must-revalidate, proxy-revalidate')
  h.set('pragma','no-cache'); h.set('expires','0'); h.set('surrogate-control','no-store')
  return new Response(JSON.stringify(data), { ...init, headers: h, status: init.status ?? 200 })
}

function getClient() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) { cookiesToSet.forEach((c) => cookieStore.set(c.name, c.value)) },
      },
    },
  )
  return supabase
}

export async function GET(_: Request, ctx: { params: { leagueId: string } }) {
  const supabase = getClient()
  const leagueId = ctx.params.leagueId
  if (!leagueId) return json({ error: 'leagueId required' }, { status: 400 })

  // RLS ensures only owners/admins can see these; we just pass through
  const { data, error } = await supabase
    .from('league_invites')
    .select('*')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })

  if (error) return json({ error: error.message }, { status: 500 })
  return json({ invites: data ?? [] })
}

export async function POST(req: Request, ctx: { params: { leagueId: string } }) {
  const supabase = getClient()
  const leagueId = ctx.params.leagueId
  if (!leagueId) return json({ error: 'leagueId required' }, { status: 400 })
  const body = await req.json().catch(() => ({} as any))
  const email = (body?.email ?? null) as string | null
  const role = (body?.role ?? 'member') as string
  if (!['admin','member'].includes(role)) return json({ error: 'invalid role' }, { status: 400 })

  const { data, error } = await supabase
    .from('league_invites')
    .insert({ league_id: leagueId, email, role })
    .select('*')
    .single()

  if (error) return json({ error: error.message }, { status: 500 })
  return json({ ok: true, invite: data })
}

export async function DELETE(req: Request, ctx: { params: { leagueId: string } }) {
  const supabase = getClient()
  const leagueId = ctx.params.leagueId
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!leagueId || !token) return json({ error: 'leagueId and token required' }, { status: 400 })

  const { error } = await supabase
    .from('league_invites')
    .delete()
    .eq('league_id', leagueId)
    .eq('token', token)

  if (error) return json({ error: error.message }, { status: 500 })
  return json({ ok: true })
}
