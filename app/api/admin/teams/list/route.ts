import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user ?? null

  const owners = (process.env.SITE_OWNER_EMAILS ?? '')
    .split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
  const isOwner = !!(user?.email && owners.includes(user.email.toLowerCase()))
  if (!isOwner) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('teams')
    .select(`
      id, abbreviation, short_name, name,
      color_primary, color_secondary, color_tertiary, color_quaternary,
      ui_light_color_key, ui_dark_color_key,
      color_pref_light, color_pref_dark
    `)
    .order('abbreviation', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
  }
  return NextResponse.json({ ok: true, teams: data || [] })
}
