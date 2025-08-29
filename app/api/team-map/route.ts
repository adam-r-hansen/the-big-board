import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET() {
  const sb = service()
  const { data, error } = await sb
    .from('teams')
    .select('id, name, abbreviation, logo, logo_dark, color_primary, color_secondary, color_tertiary, color_quaternary')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const map: Record<string, any> = {}
  for (const t of data ?? []) map[t.id] = t
  return NextResponse.json({ teams: map })
}
