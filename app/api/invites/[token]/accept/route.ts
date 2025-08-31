import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

function json(data: any, init: ResponseInit = {}) {
  const h = new Headers(init.headers)
  h.set('cache-control','no-store, no-cache, must-revalidate, proxy-revalidate')
  h.set('pragma','no-cache'); h.set('expires','0'); h.set('surrogate-control','no-store')
  return new Response(JSON.stringify(data), { ...init, headers: h, status: init.status ?? 200 })
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Must be signed in; email must match invite.email
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!token) return json({ error: 'token required' }, { status: 400 })

  // Get authed user (anon key + cookies)
  const store = await cookies()
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  )

  const { data: userRes, error: userErr } = await sb.auth.getUser()
  if (userErr) return json({ error: userErr.message }, { status: 500 })
  const user = userRes?.user
  if (!user?.email) return json({ error: 'sign in required' }, { status: 401 })

  const email = user.email.toLowerCase()

  // Look up invite
  const a = admin()
  const { data: invite, error: invErr } = await a
    .from('league_invites')
    .select('league_id,email,role,token')
    .eq('token', token)
    .single()

  if (invErr) return json({ error: invErr.message }, { status: 404 })
  if (invite.email.toLowerCase() !== email) {
    return json({ error: 'invite email does not match signed-in user' }, { status: 403 })
  }

  // Add membership if not already present
  const { error: insErr } = await a
    .from('league_members')
    .upsert(
      [{ league_id: invite.league_id, profile_id: user.id, role: invite.role ?? 'member' }],
      { onConflict: 'league_id,profile_id' }
    )

  if (insErr) return json({ error: insErr.message }, { status: 500 })

  // Delete the invite
  await a.from('league_invites').delete().eq('token', token)

  return json({ ok: true })
}
