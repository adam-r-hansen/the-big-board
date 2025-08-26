import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { fetchWeekSchedule } from '@/lib/espn'

export async function POST(req: NextRequest) {
  const season = Number(new URL(req.url).searchParams.get('season'))
  const week = Number(new URL(req.url).searchParams.get('week'))
  if (!season || !week) {
    return NextResponse.json({ error: 'season & week required' }, { status: 400 })
  }

  const sb = supabaseServer()
  const events = await fetchWeekSchedule(season, week)

  // Ensure week record
  await sb.from('weeks').upsert({ season, week }, { onConflict: 'season,week' })

  // Build rows + DEDUPE by espn_id to avoid Postgres "affect row a second time"
  const byId = new Map<number, any>()
  for (const ev of events) {
    const comp = ev?.competitions?.[0]
    if (!comp) continue

    const date = comp.date
    const h = comp.competitors?.find((c: any) => c.homeAway === 'home')
    const a = comp.competitors?.find((c: any) => c.homeAway === 'away')
    if (!h || !a) continue

    // look up team UUIDs by ESPN id
    const hid = Number(h.team.id)
    const aid = Number(a.team.id)
    const [{ data: hteam }, { data: ateam }] = await Promise.all([
      sb.from('teams').select('id').eq('espn_id', hid).maybeSingle(),
      sb.from('teams').select('id').eq('espn_id', aid).maybeSingle(),
    ])

    const row = {
      season,
      week,
      game_utc: date,
      home_team: hteam?.id || null,
      away_team: ateam?.id || null,
      home_score: h.score ? Number(h.score) : null,
      away_score: a.score ? Number(a.score) : null,
      status: (comp.status?.type?.name || comp.status?.type?.state || 'scheduled').toLowerCase(),
      espn_id: Number(ev.id),
    }

    byId.set(row.espn_id, row) // last one wins; ensures one row per espn_id
  }

  const uniqueRows = Array.from(byId.values())
  if (uniqueRows.length === 0) {
    return NextResponse.json({ upserted: 0, note: 'No events found for this week.' })
  }

  const { data, error } = await sb.from('games').upsert(uniqueRows, { onConflict: 'espn_id' }).select('id')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ upserted: data?.length ?? 0 })
}

