import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
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

async function getUserClient() {
  const store = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Supabase anon key or URL missing')
  return createServerClient(url, anon, { cookies: { getAll: () => store.getAll(), setAll: () => {} } })
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const svc = process.env.SUPABASE_SERVICE_ROLE!
  if (!url || !svc) throw new Error('Service role or URL missing')
  return createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } })
}

// List invites
export async function GET(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params
  const sb = await getUserClient()
  const { data, error } = await sb
    .from('league_invites')
    .select('token,email,role,created_at')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })
  if (error) return noStoreJson({ error: error.message }, { status: 500 })
  return noStoreJson({ invites: data ?? [] })
}

// Create/refresh invite and try to send an email (via Auth admin invite)
export async function POST(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params
  const sb = await getUserClient()
  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || ''

  const body = await req.json().catch(() => ({} as any))
  const email = String(body?.email ?? '').trim().toLowerCase()
  const role = String(body?.role ?? 'member').trim().toLowerCase()
  if (!email) return noStoreJson({ error: 'email required' }, { status: 400 })
  if (!['member','admin'].includes(role)) return noStoreJson({ error: 'invalid role' }, { status: 400 })

  const { data, error } = await sb
    .from('league_invites')
    .upsert([{ league_id: leagueId, email, role }], { onConflict: 'league_id,email' })
    .select('token,email,role')
    .single()
  if (error) return noStoreJson({ error: error.message }, { status: 500 })

  const acceptUrl = `${origin.replace(/\/$/, '')}/invites/${data.token}`

  // Try to send email via Supabase Auth (requires SMTP configured in Supabase)
  let emailSent = false, emailError: string | undefined
  try {
    const admin = getAdminClient()
    const { error: e } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: acceptUrl })
    if (e) emailError = e.message
    else emailSent = true
  } catch (e: any) {
    emailError = e?.message ?? 'invite email failed'
  }

  return noStoreJson({ ok: true, invite: data, acceptUrl, email: { sent: emailSent, error: emailError } })
}

// Revoke invite (by token or email)
export async function DELETE(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params
  const sb = await getUserClient()
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
