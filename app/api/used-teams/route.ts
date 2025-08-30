// NEW CONTENT: Replace the entire file with this block
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ used: [] })

  const { data, error } = await sb
    .from('picks')
    .select('team_id')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: true }) // optional

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const used = Array.from(new Set((data ?? []).map(r => r.team_id)))
  return NextResponse.json({ used })
}

