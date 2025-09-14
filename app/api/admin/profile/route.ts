import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 401 })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('query') || '').trim()
  if (!q) return NextResponse.json({ profile: null })

  // accept id or email fragment
  const byId = await supabase.from('profiles').select('id,email,display_name').eq('id', q).maybeSingle()
  if (!byId.error && byId.data) return NextResponse.json({ profile: byId.data })

  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,display_name')
    .ilike('email', `%${q}%`)
    .limit(1)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ profile: data ?? null })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 401 })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { profileId, display_name } = await req.json().catch(() => ({}))
  if (!profileId || typeof display_name !== 'string') {
    return NextResponse.json({ error: 'profileId and display_name required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name })
    .eq('id', profileId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
