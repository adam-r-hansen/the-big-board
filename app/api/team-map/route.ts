// app/api/team-map/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type TeamRow = {
  id: string
  name: string
  abbreviation: string
  logo: string | null
  logo_dark: string | null
  color_primary: string | null
  color_secondary: string | null
  color_tertiary: string | null
  color_quaternary: string | null
}

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE
  if (!url || !key) {
    throw new Error('Missing Supabase env vars on server.')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET() {
  try {
    const sb = service()
    const { data, error } = await sb
      .from('teams')
      .select('id, name, abbreviation, logo, logo_dark, color_primary, color_secondary, color_tertiary, color_quaternary')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (data ?? []) as TeamRow[]
    const map: Record<string, TeamRow> = {}
    for (const t of rows) map[t.id] = t

    return NextResponse.json({ teams: map })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

