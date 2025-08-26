import { NextRequest, NextResponse } from 'next/server'
import { fetchWeekSchedule } from '@/lib/espn'

export async function GET(req: NextRequest) {
  const u = new URL(req.url)
  const season = Number(u.searchParams.get('season'))
  const week = Number(u.searchParams.get('week'))
  if (!season || !week) return NextResponse.json({ error: 'season & week required' }, { status: 400 })
  const events = await fetchWeekSchedule(season, week)
  return NextResponse.json({ count: events.length, sample: events[0] })
}
