import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()

  // Profiles with no league_memberships
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, league_memberships!left(id)')
    .is('league_memberships.id', null)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data as any[]).map(r => ({
    id: r.id,
    email: r.email,
    display_name: r.display_name ?? null,
  }))

  return NextResponse.json({ rows })
}
