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

  let updates = 0
  for (const ev of events) {
    const comp = ev.competitions?.[0]
    if (!comp) continue

    const id = Number(ev.id)
    const h = comp.competitors.find((c: any) => c.homeAway === 'home')
    const a = comp.competitors.find((c: any) => c.homeAway === 'away')

    const { error } = await sb
      .from('games')
      .update({
        home_score: h.score ? Number(h.score) : null,
        away_score: a.score ? Number(a.score) : null,
        status:
          (comp.status?.type?.name || comp.status?.type?.state || 'scheduled').toLowerCase(),
      })
      .eq('espn_id', id)

    if (!error) updates++
  }

  return NextResponse.json({ updated: updates })
}

