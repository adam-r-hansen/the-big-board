// app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, preferred_color')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Profile GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const profile = data ?? {
    id: user.id,
    email: user.email ?? null,
    display_name: null,
    preferred_color: null,
  }

  // Try to detect if user has password by checking app_metadata
  // When a user signs in with password, they have different metadata than magic link users
  const userMeta = user as any
  const hasPassword = !!(
    userMeta.app_metadata?.provider === 'email' ||
    userMeta.app_metadata?.providers?.includes('email') ||
    userMeta.identities?.some((id: any) => id.provider === 'email')
  )

  console.log('User has password:', hasPassword)
  console.log('User metadata:', JSON.stringify(userMeta.app_metadata, null, 2))

  return NextResponse.json({ profile: { ...profile, has_password: hasPassword } })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    console.error('Auth error:', authErr)
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let body: any = {}
  try { body = await req.json() } catch (e) {
    console.error('JSON parse error:', e)
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const raw = String(body.display_name ?? '').trim()
  if (raw.length < 2 || raw.length > 40) {
    return NextResponse.json(
      { error: 'display_name must be 2–40 characters' },
      { status: 400 }
    )
  }

  const display_name = raw
  const preferred_color = body.preferred_color || null

  // Upsert row with preferred_color
  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        display_name,
        preferred_color,
      },
      { onConflict: 'id' }
    )

  if (error) {
    console.error('Profile upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// POST behaves like PATCH
export const POST = PATCH
