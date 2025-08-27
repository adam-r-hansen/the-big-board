import { NextRequest, NextResponse } from 'next/server'

// You can make these dynamic later; keeping fixed for now:
const SEASON = 2025
const WEEK = 1
const LEAGUE_IDS = ['11451e73-7c00-43b8-b149-c2dfc5a83581']

function resolveBase() {
  // Vercel injects this (hostname only like "your-app.vercel.app")
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  }
  // Local dev
  return 'http://localhost:3000'
}

async function call(base: string, path: string, method: 'GET'|'POST' = 'POST') {
  const res = await fetch(`${base}${path}`, { method, cache: 'no-store' })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}

async function run() {
  const base = resolveBase()
  const results: any = {}

  // 1) sanity: (idempotent) make sure the week exists
  results.import = await call(base, `/api/import-week?season=${SEASON}&week=${WEEK}`)

  // 2) scoreboard refresh for the week
  results.refresh = await call(base, `/api/refresh-scores?season=${SEASON}&week=${WEEK}`)

  // 3) re-score each league
  results.scored = []
  for (const id of LEAGUE_IDS) {
    results.scored.push(await call(base, `/api/score-week?leagueId=${id}&season=${SEASON}&week=${WEEK}`))
  }

  return NextResponse.json(results)
}

// Vercel Cron sends GET; GitHub Actions will GET as well
export async function GET(_req: NextRequest)  { return run() }
export async function POST(_req: NextRequest) { return run() }
