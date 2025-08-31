import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/utils/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init, headers: { 'content-type': 'application/json' }
  })
}

async function getUser(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  const cookies = {
    get: (name: string) => req.cookies.get(name)?.value,
    set: () => {}, remove: () => {}
  }
  const sb = createServerClient(url, anon, { cookies })
  const { data } = await sb.auth.getUser()
  return data.user || null
}

export async function POST(req: NextRequest, ctx: { params: { token: string }}) {
  try {
    const user = await getUser(req)
    if (!user) return json({ error: 'auth required' }, { status: 401 })

    const admin = createAdminClient()
    // Look up invite by token
    const { data: inv, error: invErr } = await admin
      .from('league_invites')
      .select('*')
      .eq('token', ctx.params.token)
      .maybeSingle()
    if (invErr || !inv) return json({ error: 'invalid invite' }, { status: 404 })
    if (inv.used_at) return json({ error: 'invite already used' }, { status: 409 })
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      return json({ error: 'invite expired' }, { status: 410 })
    }
    if (inv.email && inv.email.toLowerCase() !== (user.email||'').toLowerCase()) {
      return json({ error: 'invite is for a different email' }, { status: 403 })
    }

    // Upsert membership
    const { error: upErr } = await admin
      .from('league_members')
      .upsert({
        league_id: inv.league_id,
        profile_id: user.id,
        role: inv.role
      }, { onConflict: 'league_id,profile_id' })

    if (upErr) return json({ error: upErr.message }, { status: 500 })

    // Mark invite used
    await admin
      .from('league_invites')
      .update({ used_by: user.id, used_at: new Date().toISOString() })
      .eq('token', ctx.params.token)

    return json({ ok: true, leagueId: inv.league_id, role: inv.role })
  } catch (e:any) {
    return json({ error: e.message || 'error' }, { status: 400 })
  }
}
