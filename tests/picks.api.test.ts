import { describe, it, expect, vi, beforeEach } from 'vitest'

// UUIDs to satisfy Zod schema
const LEAGUE_ID = '11111111-1111-4111-8111-111111111111'
const TEAM_HOME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TEAM_AWAY = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const GAME_ID   = '22222222-2222-4222-8222-222222222222'
const USER_ID   = '00000000-0000-4000-8000-000000000001'

// Query builder that supports chained eq() for both head:true and normal selects
function makeSelectQB(tableRows: any[], head: boolean) {
  let rows = tableRows

  const qb: any = {
    // Allow destructuring { count, error } at any point
    get count() { return rows.length },
    error: null,

    // Keep chaining eq filters
    eq(col: string, val: any) {
      rows = rows.filter((r) => r?.[col] === val)
      return qb
    },

    or(_expr?: string) { return qb },
    limit(_n?: number) { return qb },

    maybeSingle<T>() {
      return { data: (rows[0] ?? null) as T, error: null }
    },

    get data() { return head ? null : rows },
  }
  return qb
}

// Delete query builder that supports chained eq() and applies on await (thenable)
function makeDeleteQB(tableRef: any[]) {
  let filters: Array<[string, any]> = []

  const qb: any = {
    error: null,

    eq(col: string, val: any) {
      filters.push([col, val])
      return qb
    },

    // Make it awaitable: when awaited, apply deletion and resolve result
    then(resolve: (v: any) => void) {
      // compute rows that match all filters
      const matches = tableRef.filter((row) =>
        filters.every(([c, v]) => row?.[c] === v)
      )
      const matchIds = new Set(matches.map((r) => r.id ?? JSON.stringify(r)))
      const before = tableRef.length
      const kept = tableRef.filter((r) => {
        const k = r.id ?? JSON.stringify(r)
        return !matchIds.has(k)
      })
      const deleted = before - kept.length
      // mutate original
      tableRef.length = 0
      tableRef.push(...kept)
      resolve({ error: null, count: deleted })
    },
  }
  return qb
}

// In-memory Supabase stub
function makeStub() {
  const state = {
    authedUserId: USER_ID,
    picks: [] as any[],
    games: [] as any[],
    league_members: [
      { league_id: LEAGUE_ID, profile_id: USER_ID, role: 'MEMBER' },
    ],
  }

  const api = {
    auth: { async getUser() { return { data: { user: { id: state.authedUserId } } } } },

    from(table: string) {
      const tableRef = (state as any)[table]

      return {
        // Support select('*', { count:'exact', head:true }) and normal selects
        select(_cols: string, opts?: { count?: 'exact', head?: boolean }) {
          const head = !!opts?.head
          return makeSelectQB(tableRef, head)
        },

        insert(rows: any[]) {
          rows.forEach((r) => { if (!r.id) r.id = crypto.randomUUID() })
          tableRef.push(...rows)
          return {
            select() { return this },
            limit() { return this },
            maybeSingle<T>() { return { data: tableRef.at(-1) as T, error: null } },
          }
        },

        delete() {
          return makeDeleteQB(tableRef)
        },
      }
    },

    _state: state,
  }
  return api
}

let stub: ReturnType<typeof makeStub>

// Mock the module that the route imports
vi.mock('@/utils/supabase/server', () => {
  return { createClient: async () => stub }
})

// Import route after mock
import * as picksRoute from '@/app/api/picks/route'

// Helper request
function mkReq(body?: any) {
  return { json: async () => body, url: 'http://localhost/api/picks' } as any
}

beforeEach(() => {
  stub = makeStub()
})

describe('picks api', () => {
  it('creates then deletes a pick', async () => {
    // Seed a future game
    const future = new Date(Date.now() + 60_000).toISOString()
    stub._state.games.push({
      id: GAME_ID,
      season: 2025,
      week: 1,
      home_team: TEAM_HOME,
      away_team: TEAM_AWAY,
      game_utc: future,
    })

    // Create
    const res: any = await picksRoute.POST(mkReq({
      leagueId: LEAGUE_ID,
      season: 2025,
      week: 1,
      teamId: TEAM_HOME,
      gameId: GAME_ID,
    }))
    const json = await res.json()
    expect(res.status ?? 200).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.id).toBeTruthy()

    // Delete
    const del: any = { url: `http://localhost/api/picks?id=${json.id}` }
    const delRes: any = await picksRoute.DELETE(del)
    const delJson = await delRes.json()
    expect(delRes.status ?? 200).toBe(200)
    expect(delJson.ok).toBe(true)
  })
})
