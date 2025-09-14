import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const ALLOWED = new Set(['color_primary','color_secondary','color_tertiary','color_quaternary'])

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { teamId, ui_light_color_key, ui_dark_color_key } = await req.json().catch(() => ({}))
  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 })
  if (!ALLOWED.has(ui_light_color_key) || !ALLOWED.has(ui_dark_color_key)) {
    return NextResponse.json({ error: 'Invalid color key' }, { status: 400 })
  }

  const { error } = await supabase
    .from('teams')
    .update({ ui_light_color_key, ui_dark_color_key })
    .eq('id', teamId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
