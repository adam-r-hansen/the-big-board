import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const query = (searchParams.get('query') || '').trim()

  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

  let sel = supabase.from('profiles').select('id, email, display_name')

  if (query.includes('@')) {
    sel = sel.ilike('email', query) // exact or case-insensitive
  } else if (query.length === 36 && query.includes('-')) {
    sel = sel.eq('id', query)
  } else {
    sel = sel.ilike('display_name', `%${query}%`)
  }

  const { data, error } = await sel.limit(1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ profile: (data && data[0]) || null })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const body = await req.json().catch(() => ({}))
  const { profileId, display_name } = body

  if (!profileId) return NextResponse.json({ error: 'profileId required' }, { status: 400 })

  const { error } = await supabase
    .from('profiles')
    .update({ display_name })
    .eq('id', profileId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
