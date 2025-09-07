import { NextRequest, NextResponse } from 'next/server'
import { createClient as createService } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  // Gate: owners only
  const userClient = await createClient()
  const { data: auth } = await userClient.auth.getUser()
  const user = auth?.user ?? null

  const owners = (process.env.SITE_OWNER_EMAILS ?? '')
    .split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
  const isOwner = !!(user?.email && owners.includes(user.email.toLowerCase()))
  if (!isOwner) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({} as any))
  const { id, ui_light_color_key, ui_dark_color_key, color_pref_light, color_pref_dark } = body || {}
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id is required' }, { status: 200 })
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: 'Missing service credentials' }, { status: 500 })
  }

  const svc = createService(url, key, { auth: { persistSession: false } })

  const { error } = await svc.from('teams').update({
    ui_light_color_key: ui_light_color_key ?? null,
    ui_dark_color_key: ui_dark_color_key ?? null,
    color_pref_light: color_pref_light ?? null,
    color_pref_dark: color_pref_dark ?? null,
  }).eq('id', id)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
  }
  return NextResponse.json({ ok: true })
}
