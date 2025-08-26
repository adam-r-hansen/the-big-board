import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { fetchTeams } from '@/lib/espn'

export async function POST() {
  const sb = supabaseServer()
  const data = await fetchTeams()

  const teams = (data?.sports?.[0]?.leagues?.[0]?.teams || []).map((t: any) => t.team)

  const rows = teams.map((t: any) => {
    const logos = Array.isArray(t.logos) ? t.logos : []
    const logoFull = logos.find((l: any) => !l.rel || l.rel.includes('full')) || logos[0]
    const logoDark = logos.find((l: any) => Array.isArray(l.rel) && l.rel.includes('dark'))

    const hex = (s?: string) => (s ? (s.startsWith('#') ? s : `#${s}`) : null)

    return {
      espn_id: t.id ? Number(t.id) : null,
      name: t.displayName,
      short_name: t.shortDisplayName,
      abbreviation: t.abbreviation,
      color_primary: hex(t.color),
      color_secondary: hex(t.alternateColor),
      // tertiary/quaternary will be enriched in a separate step
      color_tertiary: null,
      color_quaternary: null,
      logo: logoFull?.href || null,
      logo_dark: logoDark?.href || null,
      wordmark: null,
    }
  })

  const { data: up, error } = await sb
    .from('teams')
    .upsert(rows, { onConflict: 'espn_id' })
    .select('id, name, abbreviation, color_primary, color_secondary')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ inserted: up?.length ?? 0 })
}

