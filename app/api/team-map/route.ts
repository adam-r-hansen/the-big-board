import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type TeamRow = {
  id: string
  name: string
  abbreviation: string
  logo: string | null
  logo_dark: string | null
  color_primary?: string | null
  color_secondary?: string | null
  color_tertiary?: string | null
  color_quaternary?: string | null
  color_pref_light?: 'primary'|'secondary'|'tertiary'|'quaternary'|null
  color_pref_dark?:  'primary'|'secondary'|'tertiary'|'quaternary'|null
}

function absoluteLogo(urlOrPath: string | null): string | null {
  if (!urlOrPath) return null
  // Already absolute?
  if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath

  // Treat as Supabase Storage path; construct a public URL.
  // Example expected paths in DB:
  //   teams/nfl/phi.svg
  //   public/teams/phi.png
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  // Public bucket endpoint:
  //   {URL}/storage/v1/object/public/<path>
  return `${base.replace(/\/+$/, '')}/storage/v1/object/public/${urlOrPath.replace(/^\/+/, '')}`
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const { data, error } = await sb
    .from('teams')
    .select(
      'id, name, abbreviation, logo, logo_dark, color_primary, color_secondary, color_tertiary, color_quaternary, color_pref_light, color_pref_dark'
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const map: Record<string, TeamRow> = {}
  for (const t of (data ?? []) as TeamRow[]) {
    map[t.id] = {
      ...t,
      logo: absoluteLogo(t.logo),
      logo_dark: absoluteLogo(t.logo_dark),
    }
  }

  return NextResponse.json({ teams: map })
}

