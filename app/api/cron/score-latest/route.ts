import { NextRequest, NextResponse } from 'next/server'

// Basic constants for now; you can make these dynamic later.
const SEASON = 2025
const WEEK = 1
const LEAGUE_IDS = ['11451e73-7c00-43b8-b149-c2dfc5a83581']

function resolveBase() {
  // Vercel deployments expose this (host without https)
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  }
  // Local dev
  return 'http://localhost:3000'
}

async function call(base: string, path: string, method: 'GET'|'POST' = 'POST') {
  const res = await fetch(`${base}${path}`, {
    method,
    cache: 'no-store',
    headers: { 'x-cron-secret': process.env.CRON_SECRET || '' }
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}

async function run() {
  const base = resolveBase()
  const results: any = {}
  // 1) idempotent sanity: ensure week exists
  results.import = await call(base, `/api/import-week?season=${SEASON}&week=${WEEK}`)
  // 2) refresh scores
  results.refresh = await call(base, `/api/refresh-scores?season=${SEASON}&week=${WEEK}`)
  // 3) re-score leagues
  results.scored = []
  for (const id of LEAGUE_IDS) {
    results.scored.push(await call(base, `/api/score-week?leagueId=${id}&season=${SEASON}&week=${WEEK}`))
  }
  return NextResponse.json(results)
}

export async function GET(_req: NextRequest)  { return run() }
export async function POST(_req: NextRequest) { return run() }
