// app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  // Query the profiles table for has_password
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, preferred_color, has_password')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Profile GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Use database value directly, no detection logic
  const profile = data ?? {
    id: user.id,
    email: user.email ?? null,
    display_name: null,
    preferred_color: null,
    has_password: false,
  }

  // Log what we're returning
  console.log('Database profile data:', data)
  console.log('Returning profile:', profile)

  return NextResponse.json({ profile })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let body: any = {}
  try { body = await req.json() } catch (e) {
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export const POST = PATCH
