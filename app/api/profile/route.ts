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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const profile = data ?? {
    id: user.id,
    email: user.email ?? null,
    display_name: null,
    preferred_color: '#000000',
  }

  return NextResponse.json({ profile })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let body: any = {}
  try { body = await req.json() } catch { /* ignore */ }

  // Prepare update object
  const updates: any = {
    id: user.id,
    email: user.email ?? null,
  }

  // Handle display_name if provided
  if (body.display_name !== undefined) {
    const raw = String(body.display_name ?? '').trim()
    if (raw.length < 2 || raw.length > 40) {
      return NextResponse.json(
        { error: 'display_name must be 2–40 characters' },
        { status: 400 }
      )
    }
    updates.display_name = raw
  }

  // Handle preferred_color if provided
  if (body.preferred_color !== undefined) {
    const color = String(body.preferred_color ?? '').trim()
    // Basic hex validation
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return NextResponse.json(
        { error: 'preferred_color must be a valid hex color (e.g., #002a5c)' },
        { status: 400 }
      )
    }
    updates.preferred_color = color || '#000000'
  }

  // Upsert row
  const { error } = await supabase
    .from('profiles')
    .upsert(updates, { onConflict: 'id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// POST behaves like PATCH
export const POST = PATCH
