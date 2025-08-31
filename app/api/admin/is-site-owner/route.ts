import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function json(data: any, init: ResponseInit = {}) {
  const h = new Headers(init.headers)
  h.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate')
  h.set('Pragma','no-cache'); h.set('Expires','0'); h.set('Surrogate-Control','no-store')
  return new Response(JSON.stringify(data), { ...init, headers: h, status: init.status ?? 200 })
}

function emailIsSiteOwner(email?: string | null) {
  if (!email) return false
  const raw = process.env.SITE_OWNER_EMAILS || ''
  const set = new Set(raw.toLowerCase().split(',').map(s => s.trim()).filter(Boolean))
  return set.has(email.toLowerCase())
}

export async function GET(_req: NextRequest) {
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  const u = auth?.user
  if (!u) return json({ ok: true, isOwner: false })

  if (emailIsSiteOwner(u.email)) return json({ ok: true, isOwner: true, via: 'env' })

  const { data, error } = await sb
    .from('league_members')
    .select('role')
    .eq('profile_id', u.id)
    .eq('role', 'owner')
    .limit(1)

  if (error) return json({ ok: false, error: error.message }, { status: 500 })
  return json({ ok: true, isOwner: (data?.length ?? 0) > 0, via: 'db' })
}
