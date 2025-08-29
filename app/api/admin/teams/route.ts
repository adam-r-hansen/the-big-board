import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// --- helpers ---
function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE
  if (!url || !key) throw new Error('Supabase URL or service role key missing')
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

async function getUserEmail() {
  const cookieStore = await cookies() // Next 15: cookies() must be awaited
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        // Route handlers typically only need get(); set/remove are no-ops here.
        set() {},
        remove() {},
      },
    }
  )
  const { data } = await supabase.auth.getUser()
  return data.user?.email ?? null
}

function ensureAdmin(email: string | null) {
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  if (!email || !list.includes(email.toLowerCase())) {
    throw new Error('Forbidden')
  }
}

// --- GET: list teams
export async function GET() {
  try {
    const email = await getUserEmail()
    ensureAdmin(email)

    const sb = service()
    const { data, error } = await sb
      .from('teams')
      .select('id, name, abbreviation, color_primary, color_secondary, color_tertiary, color_quaternary, color_pref_light, color_pref_dark, logo, logo_dark')
      .order('abbreviation', { ascending: true })
    if (error) throw error
    return NextResponse.json({ teams: data ?? [] })
  } catch (e: any) {
    const code = e?.message === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: code })
  }
}

// --- PATCH: update one team
export async function PATCH(req: Request) {
  try {
    const email = await getUserEmail()
    ensureAdmin(email)

    const body = await req.json()
    const { id, updates } = body || {}
    if (!id || !updates) return NextResponse.json({ error: 'id and updates required' }, { status: 400 })

    // allowlist columns
    const safe: Record<string, any> = {}
    const allowed = new Set([
      'name','abbreviation',
      'logo','logo_dark',
      'color_primary','color_secondary','color_tertiary','color_quaternary',
      'color_pref_light','color_pref_dark'
    ])
    Object.keys(updates).forEach(k => { if (allowed.has(k)) safe[k] = updates[k] })

    const sb = service()
    const { error } = await sb.from('teams').update(safe).eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const code = e?.message === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: code })
  }
}

