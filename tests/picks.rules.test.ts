import { describe, it, expect, vi, beforeEach } from 'vitest'

// UUIDs to satisfy Zod schema
const LEAGUE_ID = '11111111-1111-4111-8111-111111111111'
const TEAM_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TEAM_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const TEAM_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const GAME_FUTURE_A = '22222222-2222-4222-8222-222222222222'
const GAME_FUTURE_B = '33333333-3333-4333-8333-333333333333'
const GAME_PAST = '44444444-4444-4444-8444-444444444444'
const USER_ID = '00000000-0000-4000-8000-000000000001'

// --- shared tiny supabase stub (supports chained select eq() and delete().eq().eq()) ---

function makeSelectQB(tableRows: any[], head: boolean) {
  let rows = tableRows
  const qb: any = {
    get count() { return rows.length },
    error: null,
    eq(col: string, val: any) { rows = rows.filter((r) => r?.[col] === val); return qb },
    or(_expr?: string) { return qb },
    limit(_n?: number) { return qb },
    maybeSingle<T>() { return { data: (rows[0] ?? null) as T, error: null } },
    get data() { return head ? null : rows },
  }
  return qb
}
function makeDeleteQB(tableRef: any[]) {
  let filters: Array<[string, any]> = []
  const qb: any = {
    error: null,
    eq(col: string, val: any) { filters.push([col, val]); return qb },
    then(resolve: (v: any)=>void) {
      const matches = tableRef.filter((row) => filters.every(([c,v]) => row?.[c] === v))
      const ids = new Set(matches.map((r) => r.id ?? JSON.stringify(r)))
      const before = tableRef.length
      const kept = tableRef.filter((r) => !ids.has(r.id ?? JSON.stringify(r)))
      tableRef.length = 0; tableRef.push(...kept)
      resolve({ error: null, count: before - kept.length })
    },
  }
  return qb
}
function makeStub() {
  const state = {
    authedUserId: USER_ID,
    picks: [] as any[],
    games: [] as any[],
    league_members: [{ league_id: LEAGUE_ID, profile_id: USER_ID, role: 'MEMBER' }],
  }
  const api = {
    auth: { async getUser(){ return { data: { user: { id: state.authedUserId } } } } },
    from(table: string) {
      const tableRef = (state as any)[table]
      return {
        select(_cols: string, opts?: {count?: 'exact', head?: boolean}) {
          const head = !!opts?.head; return makeSelectQB(tableRef, head)
        },
        insert(rows: any[]) {
          rows.forEach((r)=>{ if(!r.id) r.id = crypto.randomUUID() })
          tableRef.push(...rows)
          return { select(){return this}, limit(){return this}, maybeSingle<T>(){ return { data: tableRef.at(-1) as T, error: null } } }
        },
        delete(){ return makeDeleteQB(tableRef) },
      }
    },
    _state: state,
  }
  return api
}
let stub: ReturnType<typeof makeStub>

// Mock the module the route imports
vi.mock('@/utils/supabase/server', () => ({ createClient: async () => stub }))

// Import the route AFTER the mock
import * as picksRoute from '@/app/api/picks/route'
function mkReq(body?: any){ return { json: async()=>body, url: 'http://localhost/api/picks' } as any }

beforeEach(() => { stub = makeStub() })

describe('picks rules', () => {
  it('enforces weekly quota of 2 picks', async () => {
    // Seed two future games (same week)
    const future = new Date(Date.now() + 60_000).toISOString()
    stub._state.games.push({ id: GAME_FUTURE_A, season: 2025, week: 1, home_team: TEAM_A, away_team: TEAM_B, game_utc: future })
    stub._state.games.push({ id: GAME_FUTURE_B, season: 2025, week: 1, home_team: TEAM_C, away_team: TEAM_B, game_utc: future })

    // 1st pick → OK
    let res: any = await picksRoute.POST(mkReq({ leagueId: LEAGUE_ID, season: 2025, week: 1, teamId: TEAM_A, gameId: GAME_FUTURE_A }))
    expect(res.status ?? 200).toBe(200)

    // 2nd pick → OK
    res = await picksRoute.POST(mkReq({ leagueId: LEAGUE_ID, season: 2025, week: 1, teamId: TEAM_C, gameId: GAME_FUTURE_B }))
    expect(res.status ?? 200).toBe(200)

    // 3rd pick same week → should fail with 400
    const third = await picksRoute.POST(mkReq({ leagueId: LEAGUE_ID, season: 2025, week: 1, teamId: TEAM_B, gameId: GAME_FUTURE_A }))
    expect(third.status).toBe(400)
    const body = await third.json()
    expect(body?.error || '').toMatch(/quota/i)
  })

  it('prevents picking after kickoff (game locked)', async () => {
    // Seed past game
    const past = new Date(Date.now() - 60_000).toISOString()
    stub._state.games.push({ id: GAME_PAST, season: 2025, week: 2, home_team: TEAM_A, away_team: TEAM_B, game_utc: past })

    const res: any = await picksRoute.POST(mkReq({ leagueId: LEAGUE_ID, season: 2025, week: 2, teamId: TEAM_A, gameId: GAME_PAST }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body?.error || '').toMatch(/locked/i)
  })
})
