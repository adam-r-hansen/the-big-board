import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

function noStoreJson(data: any, init: ResponseInit = {}) {
  const h = new Headers(init.headers)
  h.set('cache-control','no-store, no-cache, must-revalidate, proxy-revalidate')
  h.set('pragma','no-cache'); h.set('expires','0'); h.set('surrogate-control','no-store')
  return new Response(JSON.stringify(data), { ...init, headers: h, status: init.status ?? 200 })
}

function getAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY || ''
  )
}

async function userClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = getAnonKey()
  if (!url || !key) throw new Error('Missing Supabase anon key or URL')
  const store = await cookies()
  return createServerClient(url, key, { cookies: { getAll: () => store.getAll(), setAll: () => {} } })
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const svc = process.env.SUPABASE_SERVICE_ROLE || ''
  if (!url || !svc) throw new Error('Missing service role or URL')
  return createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function assertLeagueAdmin(leagueId: string) {
  const sb = await userClient()
  const { data: ures, error: uerr } = await sb.auth.getUser()
  if (uerr) throw new Error(uerr.message)
  const user = ures?.user
  if (!user?.id) throw new Error('unauthorized')

  const a = adminClient()
  const { data, error } = await a
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('profile_id', user.id)
    .in('role', ['owner','admin'])
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('forbidden')
  return { userId: user.id }
}

export async function GET(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params
  try {
    await assertLeagueAdmin(leagueId)
    const a = adminClient()
    const { data, error } = await a
      .from('league_members')
      .select('profile_id, role, profiles ( display_name, email )')
      .eq('league_id', leagueId)
      .order('role', { ascending: true })
    if (error) return noStoreJson({ error: error.message }, { status: 500 })
    return noStoreJson({ members: data ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return noStoreJson({ error: msg }, { status: msg === 'unauthorized' ? 401 : 403 })
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params
  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || ''
  try {
    await assertLeagueAdmin(leagueId)
    const a = adminClient()
    const body = await req.json().catch(() => ({} as any))
    const email = String(body?.email ?? '').trim().toLowerCase()
    const role = String(body?.role ?? 'member').trim().toLowerCase()
    if (!email) return noStoreJson({ error: 'email required' }, { status: 400 })
    if (!['owner','admin','member'].includes(role)) return noStoreJson({ error: 'invalid role' }, { status: 400 })

    const { data: prof } = await a.from('profiles').select('id,email').eq('email', email).maybeSingle()
    if (prof?.id) {
      const { error: merr } = await a
        .from('league_members')
        .upsert([{ league_id: leagueId, profile_id: prof.id, role }], { onConflict: 'league_id,profile_id' })
      if (merr) return noStoreJson({ error: merr.message }, { status: 500 })
      return noStoreJson({ ok: true, added: true })
    }

    const { data: inv, error: ierr } = await a
      .from('league_invites')
      .upsert([{ league_id: leagueId, email, role: role === 'owner' ? 'admin' : role }], { onConflict: 'league_id,email' })
      .select('token,email,role')
      .single()
    if (ierr) return noStoreJson({ error: ierr.message }, { status: 500 })

    const acceptUrl = `${origin.replace(/\/$/, '')}/invites/${inv.token}`
    return noStoreJson({ ok: true, invited: true, acceptUrl, invite: inv })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    const status = msg === 'unauthorized' ? 401 : (msg === 'forbidden' ? 403 : 500)
    return noStoreJson({ error: msg }, { status })
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params
  try {
    await assertLeagueAdmin(leagueId)
    const a = adminClient()
    const url = new URL(req.url)
    const profileId = url.searchParams.get('profileId') || undefined
    const email = url.searchParams.get('email')?.toLowerCase()
    const token = url.searchParams.get('token') || undefined

    if (!profileId && !email && !token)
      return noStoreJson({ error: 'profileId, email, or token required' }, { status: 400 })

    if (profileId) {
      const { error } = await a.from('league_members').delete().eq('league_id', leagueId).eq('profile_id', profileId)
      if (error) return noStoreJson({ error: error.message }, { status: 500 })
      return noStoreJson({ ok: true })
    }

    if (email) {
      await a.from('league_invites').delete().eq('league_id', leagueId).eq('email', email)
      const { data: prof } = await a.from('profiles').select('id').eq('email', email).maybeSingle()
      if (prof?.id) await a.from('league_members').delete().eq('league_id', leagueId).eq('profile_id', prof.id)
      return noStoreJson({ ok: true })
    }

    if (token) {
      await a.from('league_invites').delete().eq('token', token)
      return noStoreJson({ ok: true })
    }

    return noStoreJson({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    const status = msg === 'unauthorized' ? 401 : (msg === 'forbidden' ? 403 : 500)
    return noStoreJson({ error: msg }, { status })
  }
}
