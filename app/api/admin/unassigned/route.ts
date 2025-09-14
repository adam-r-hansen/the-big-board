import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // If you have an RPC, use it; else fallback.
  const rpc = await supabase.rpc('profiles_without_league')
  if (!rpc.error) {
    const rows = (rpc.data || []).map((r: any) => ({
      id: r.id, email: r.email, display_name: r.display_name ?? null
    }))
    return NextResponse.json({ rows })
  }

  const { data: rows, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, league_members:league_members(id)')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const filtered = (rows || [])
    .filter((r: any) => !r.league_members || r.league_members.length === 0)
    .map((r: any) => ({ id: r.id, email: r.email, display_name: r.display_name ?? null }))
  return NextResponse.json({ rows: filtered })
}
