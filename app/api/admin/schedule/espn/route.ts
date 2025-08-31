import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function json(data: any, init: ResponseInit = {}) {
  const h = new Headers(init.headers)
  h.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate')
  h.set('Pragma','no-cache'); h.set('Expires','0'); h.set('Surrogate-Control','no-store')
  return new Response(JSON.stringify(data, null, 2), { ...init, headers: h, status: init.status ?? 200 })
}

function emailIsSiteOwner(email?: string | null) {
  if (!email) return false
  const raw = process.env.SITE_OWNER_EMAILS || ''
  const set = new Set(raw.toLowerCase().split(',').map(s => s.trim()).filter(Boolean))
  return set.has(email.toLowerCase())
}

// Accept "2-3", "2,3", [2,3], 2, "all"
function parseWeeks(input: unknown): number[] {
  if (input === 'all') return Array.from({ length: 18 }, (_, i) => i + 1)
  if (Array.isArray(input)) return input.map(n => Number(n)).filter(n => Number.isFinite(n))
  if (typeof input === 'number') return [input]
  if (typeof input === 'string') {
    const s = input.trim()
    if (/^\d+\s*-\s*\d+$/.test(s)) {
      const [a,b] = s.split('-').map(x => Number(x.trim()))
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const lo = Math.min(a,b), hi = Math.max(a,b)
        return Array.from({ length: hi - lo + 1 }, (_,i)=> lo + i)
      }
    }
    return s.split(/[,\s]+/).map(x => Number(x)).filter(n => Number.isFinite(n))
  }
  return []
}

type Item = { week: number; kickoff: string; home: string; away: string }

async function fetchScoreboard(season: number, week: number): Promise<Item[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}&seasontype=2&week=${week}&limit=200`
  const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'the-big-board/1.0' } })
  if (!res.ok) throw new Error(`scoreboard ${res.status}`)
  const data: any = await res.json()
  const events: any[] = data?.events ?? []
  const out: Item[] = []
  for (const ev of events) {
    const comp = ev?.competitions?.[0]
    const date = comp?.date || ev?.date
    const comps: any[] = comp?.competitors ?? []
    const homeC = comps.find(c => c?.homeAway === 'home')
    const awayC = comps.find(c => c?.homeAway === 'away')
    const home = homeC?.team?.abbreviation || homeC?.team?.displayName
    const away = awayC?.team?.abbreviation || awayC?.team?.displayName
    if (!date || !home || !away) continue
    out.push({ week, kickoff: new Date(date).toISOString(), home, away })
  }
  return out
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function fetchCoreWeek(season: number, week: number): Promise<Item[]> {
  const listUrl = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${season}/types/2/weeks/${week}/events?limit=200`
  const res = await fetch(listUrl, { cache: 'no-store', headers: { 'User-Agent': 'the-big-board/1.0' } })
  if (!res.ok) throw new Error(`core-list ${res.status}`)
  const data: any = await res.json()
  const items: any[] = data?.items ?? []
  const out: Item[] = []
  for (const it of items) {
    const href: string = it?.$ref || it?.href
    const id = href?.match(/events\/(\d+)/)?.[1]
    if (!id) continue
    const sumUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${id}`
    const sres = await fetch(sumUrl, { cache: 'no-store', headers: { 'User-Agent': 'the-big-board/1.0' } })
    if (!sres.ok) continue
    const s: any = await sres.json().catch(() => ({}))
    const header = s?.header
    const comp = header?.competitions?.[0]
    const date = comp?.date || header?.date
    const comps: any[] = comp?.competitors ?? []
    const homeC = comps.find(c => c?.homeAway === 'home')
    const awayC = comps.find(c => c?.homeAway === 'away')
    const home = homeC?.team?.abbreviation || homeC?.team?.displayName
    const away = awayC?.team?.abbreviation || awayC?.team?.displayName
    if (date && home && away) out.push({ week, kickoff: new Date(date).toISOString(), home, away })
    await sleep(60)
  }
  return out
}

function normalizeKey(s: string): string {
  const raw = s.trim().toUpperCase()
  const map: Record<string,string> = {
    WSH:'WAS', JAX:'JAC', ARZ:'ARI', NOR:'NO', NWE:'NE', TBB:'TB', KAN:'KC', GNB:'GB', SFO:'SF',
    OAK:'LV', LVR:'LV', SD:'LAC', LA:'LAR'
  }
  return map[raw] || raw
}

export async function GET(_req: NextRequest) {
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  const email = auth?.user?.email ?? null
  let isLeagueOwner = false
  if (auth?.user?.id) {
    const { data } = await sb.from('league_members')
      .select('id').eq('profile_id', auth.user.id).eq('role','owner').limit(1)
    isLeagueOwner = !!(data && data.length > 0)
  }
  return json({
    ok: true,
    whoami: email,
    isSiteOwner: emailIsSiteOwner(email),
    isLeagueOwner,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  })
}

export async function POST(req: NextRequest) {
  let body: any = null
  try { body = await req.json() } catch {}
  const season = Number(body?.season)
  const weeksRaw = body?.weeks ?? 'all'
  const weeks = parseWeeks(weeksRaw)

  if (!Number.isFinite(season)) return json({ ok:false, error: 'season required' }, { status: 400 })
  if (!weeks.length) return json({ ok:false, error: 'weeks invalid', got: weeksRaw }, { status: 400 })

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  const u = auth?.user
  if (!u) return json({ ok:false, error: 'unauthenticated' }, { status: 401 })

  // Allow SITE_OWNER_EMAILS or any league 'owner'
  const isSiteOwner = emailIsSiteOwner(u.email)
  let isLeagueOwner = false
  if (!isSiteOwner) {
    const { data: rows, error } = await sb
      .from('league_members').select('role').eq('profile_id', u.id).eq('role','owner').limit(1)
    if (error) return json({ ok:false, error: 'owner check failed: '+error.message }, { status: 500 })
    isLeagueOwner = !!(rows && rows.length > 0)
    if (!isLeagueOwner) return json({ ok:false, error: 'forbidden (owner required)' }, { status: 403 })
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (e: any) {
    return json({ ok:false, error: 'admin client: '+(e?.message || String(e)), hint: 'Check SUPABASE_SERVICE_ROLE_KEY in Vercel' }, { status: 500 })
  }

  const { data: teams, error: tErr } = await admin.from('teams').select('id, abbreviation, name')
  if (tErr) return json({ ok:false, error: 'teams read: '+tErr.message }, { status: 500 })
  const norm = (s: string) => s.trim().toLowerCase()
  const index = new Map<string,string>()
  for (const t of teams ?? []) {
    index.set(norm(t.abbreviation), t.id)
    index.set(norm(t.name), t.id)
    index.set(norm(normalizeKey(t.abbreviation)), t.id)
  }
  const findTeamId = (key: string) => index.get(norm(normalizeKey(key))) || index.get(norm(key)) || null

  const allItems: Item[] = []
  const fetchErrors: Array<{ week: number; error: string }> = []
  for (const w of weeks) {
    try {
      let items = await fetchScoreboard(season, w)
      if (!items.length) items = await fetchCoreWeek(season, w)
      allItems.push(...items)
    } catch (e: any) {
      fetchErrors.push({ week: Number(w), error: e?.message || 'fetch failed' })
    }
  }

  const rows: Array<{season:number;week:number;home_team:string;away_team:string;game_utc:string;status:string}> = []
  const unknown: Item[] = []
  for (const it of allItems) {
    const homeId = findTeamId(it.home)
    const awayId = findTeamId(it.away)
    if (!homeId || !awayId) { unknown.push(it); continue }
    rows.push({
      season, week: it.week,
      home_team: homeId, away_team: awayId,
      game_utc: it.kickoff, status: 'UPCOMING'
    })
  }

  let upsertError: string | null = null
  if (rows.length) {
    const { error } = await admin
      .from('games')
      .upsert(rows, { onConflict: 'season,week,home_team,away_team', ignoreDuplicates: false })
    if (error) upsertError = error.message
  }

  return json({
    ok: !upsertError,
    season, weeks,
    counts: { fetched: allItems.length, touched: rows.length, unknownTeams: unknown.length },
    fetchErrors, unknown, upsertError
  }, { status: upsertError ? 500 : 200 })
}
