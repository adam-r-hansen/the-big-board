import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const sb = await createClient()
  // With the RLS policy ("read leagues I belong to"), this only returns your leagues.
  const { data, error } = await sb
    .from('leagues')
    .select('id, name, season')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leagues: data ?? [] })
}
