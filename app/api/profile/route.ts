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
    .select('id, email, full_name, display_name')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const profile = data ?? {
    id: user.id,
    email: user.email ?? null,
    full_name: (user.user_metadata as any)?.full_name ?? null,
    display_name: null,
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

  const raw = String(body.display_name ?? '').trim()
  if (raw.length < 2 || raw.length > 40) {
    return NextResponse.json(
      { error: 'display_name must be 2–40 characters' },
      { status: 400 }
    )
  }

  const display_name = raw

  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        display_name,
        email: user.email ?? null,
        full_name: (user.user_metadata as any)?.full_name ?? null,
      },
      { onConflict: 'id' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// Allow POST as an alias for PATCH
export const POST = PATCH
