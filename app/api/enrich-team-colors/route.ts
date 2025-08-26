import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

function csvParse(text: string) {
  const lines = text.trim().split(/\r?\n/)
  const header = lines.shift()!.split(',')
  return lines.map(line => {
    // simple CSV (no quoted commas in this dataset)
    const cols = line.split(',')
    const row: any = {}
    header.forEach((h, i) => (row[h] = cols[i]))
    return row
  })
}

export async function POST() {
  try {
    // Official nflfastR data mirror on GitHub (colors/logos/wordmarks)
    const url = 'https://raw.githubusercontent.com/nflverse/nflfastR-data/master/teams_colors_logos.csv'
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) {
      const txt = await res.text().catch(()=>'')
      throw new Error(`nflfastR fetch failed ${res.status} :: ${txt.slice(0,120)}`)
    }
    const csv = await res.text()
    const rows = csvParse(csv)

    const sb = supabaseServer()
    let updated = 0

    for (const r of rows) {
      const abbr = (r.team_abbr || '').toUpperCase().trim()
      if (!abbr) continue
      // Normalize hex fields, ensure leading '#'
      const fix = (s?: string) => s ? (s.startsWith('#') ? s : `#${s}`) : null

      const { error } = await sb
        .from('teams')
        .update({
          color_tertiary: fix(r.team_color3) || null,
          color_quaternary: fix(r.team_color4) || null,
          // optional: use nflverse wordmark if present
          wordmark: r.team_wordmark || null,
          // optionally overwrite ESPN logo if nflverse has direct link
          // logo: r.team_logo_espn || null,
        })
        .eq('abbreviation', abbr)

      if (!error) updated++
    }

    return NextResponse.json({ enriched: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 })
  }
}
