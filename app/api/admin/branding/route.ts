import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId')

  const q = supabase
    .from('ui_settings')
    .select('id, league_id, pill_light, pill_dark')
    .order('updated_at', { ascending: false })

  const { data, error } = leagueId
    ? await q.eq('league_id', leagueId)
    : await q.is('league_id', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const row = (data || [])[0] || null
  return NextResponse.json(row || {})
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leagueId, pill_light, pill_dark } = await req.json().catch(() => ({}))
  if (!pill_light || !pill_dark) {
    return NextResponse.json({ error: 'pill_light and pill_dark required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('ui_settings')
    .upsert(
      { league_id: leagueId ?? null, pill_light, pill_dark, updated_at: new Date().toISOString() },
      { onConflict: 'league_id' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
