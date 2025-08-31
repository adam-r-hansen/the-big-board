import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

function noStoreJson(data: any, init: ResponseInit = {}) {
  const h = new Headers(init.headers)
  h.set('cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  h.set('pragma', 'no-cache'); h.set('expires', '0'); h.set('surrogate-control', 'no-store')
  return new Response(JSON.stringify(data), { ...init, headers: h, status: init.status ?? 200 })
}

// Next 15: cookies() is async and read-only
async function getClient() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return store.getAll() },
        setAll() { /* no-op in route handlers */ },
      },
    }
  )
}

export async function GET(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params
  const sb = await getClient()

  const { data, error } = await sb
    .from('league_invites')
    .select('token,email,role,created_at')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })

  if (error) return noStoreJson({ error: error.message }, { status: 500 })
  return noStoreJson({ invites: data ?? [] })
}

export async function POST(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params
  const sb = await getClient()
  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || ''

  const body = await req.json().catch(() => ({} as any))
  const rawEmail = (body?.email ?? '').toString()
  const role = (body?.role ?? 'member').toString().toLowerCase()

  if (!rawEmail) return noStoreJson({ error: 'email required' }, { status: 400 })
  if (!['member','admin'].includes(role)) return noStoreJson({ error: 'invalid role' }, { status: 400 })

  const email = rawEmail.trim().toLowerCase()

  // If a profile exists we record it, otherwise we still create the invite.
  let profileId: string | null = null
  {
    const { data } = await sb
      .from('profiles')
      .select('id')
      .eq('email', email)
      .limit(1)
    profileId = data?.[0]?.id ?? null
  }

  // Create or update invite for that email/league
  const { data, error } = await sb
    .from('league_invites')
    .upsert(
      [{ league_id: leagueId, email, role, profile_id: profileId ?? null }],
      { onConflict: 'league_id,email' }
    )
    .select('token,email,role')
    .single()

  if (error) return noStoreJson({ error: error.message }, { status: 500 })

  const acceptUrl = `${origin.replace(/\/$/, '')}/invites/${data.token}`
  return noStoreJson({ ok: true, invite: data, acceptUrl })
}

export async function DELETE(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params
  const sb = await getClient()
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const email = url.searchParams.get('email')?.toLowerCase()

  if (!token && !email) return noStoreJson({ error: 'token or email required' }, { status: 400 })

  const q = sb.from('league_invites').delete().eq('league_id', leagueId)
  if (token) q.eq('token', token)
  if (email) q.eq('email', email)

  const { error } = await q
  if (error) return noStoreJson({ error: error.message }, { status: 500 })
  return noStoreJson({ ok: true })
}
