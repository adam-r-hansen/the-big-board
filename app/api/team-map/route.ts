// app/api/team-map/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type PrefKey = 'primary' | 'secondary' | 'tertiary' | 'quaternary'

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
  color_pref_light: PrefKey | null
  color_pref_dark: PrefKey | null
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET() {
  const sb = serviceClient()

  // NB: don’t over-cast; just guard the shape we expect.
  const { data, error } = await sb
    .from('teams')
    .select(
      [
        'id',
        'name',
        'abbreviation',
        'logo',
        'logo_dark',
        'color_primary',
        'color_secondary',
        'color_tertiary',
        'color_quaternary',
        'color_pref_light',
        'color_pref_dark',
      ].join(', ')
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows: TeamRow[] = Array.isArray(data) ? (data as unknown as TeamRow[]) : []

  const map: Record<string, TeamRow> = {}
  for (const t of rows) map[t.id] = t

  return NextResponse.json({ teams: map })
}

