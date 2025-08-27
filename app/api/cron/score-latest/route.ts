import { NextRequest, NextResponse } from 'next/server'

const SEASON = 2025
const WEEK = 1
const LEAGUE_IDS = ['11451e73-7c00-43b8-b149-c2dfc5a83581']

function resolveBase() {
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    // e.g. my-app.vercel.app
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  }
  // local dev
  return 'http://localhost:3000'
}

async function call(base: string, path: string, method = 'POST') {
  const res = await fetch(`${base}${path}`, { method })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}

async function run() {
  const base = resolveBase()
  const results: any = {}
  results.import = await call(base, `/api/import-week?season=${SEASON}&week=${WEEK}`)
  results.refresh = await call(base, `/api/refresh-scores?season=${SEASON}&week=${WEEK}`)
  results.scored = []
  for (const id of LEAGUE_IDS) {
    results.scored.push(await call(base, `/api/score-week?leagueId=${id}&season=${SEASON}&week=${WEEK}`))
  }
  return NextResponse.json(results)
}

export async function GET(_req: NextRequest)  { return run() } // Vercel Cron hits GET
export async function POST(_req: NextRequest) { return run() }
