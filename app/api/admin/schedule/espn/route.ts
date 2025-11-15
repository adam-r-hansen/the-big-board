import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-clients'
import { createAdminSupabaseClient } from '@/lib/supabase-clients'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

function emailIsSiteOwner(email: string | null): boolean {
  if (!email) return false
  const owners = (process.env.SITE_OWNER_EMAILS || '').split(',').map(e => e.trim().toLowerCase())
  return owners.includes(email.toLowerCase())
}

type Item = { week: number; kickoff: string; home: string; away: string }

async function fetchSiteWeek(season: number, week: number): Promise<Item[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}&seasontype=2&week=${week}`
  const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'the-big-board/1.0' } })
  if (!res.ok) throw new Error(`site ${res.status}`)
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
  const sb = await createServerSupabaseClient()
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
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  })
}

export async function POST(req: NextRequest) {
  const sb = await createServerSupabaseClient()
  const { data: auth } = await sb.auth.getUser()
  const email = auth?.user?.email ?? null
  if (!emailIsSiteOwner(email)) return json({ error: 'forbidden' }, 403)

  const body = await req.json().catch(() => ({ season: 2025, weeks: [1] }))
  const season = Number(body?.season ?? 2025)
  const weeks: number[] = Array.isArray(body?.weeks) ? body.weeks : [1]
  const mode: 'site'|'core' = body?.mode === 'core' ? 'core' : 'site'

  const adminSb = createAdminSupabaseClient()
  const { data: teams } = await adminSb.from('teams').select('id, abbreviation')
  const teamMap = new Map<string, string>()
  for (const t of teams ?? []) {
    if (t.abbreviation) teamMap.set(normalizeKey(t.abbreviation), t.id)
  }

  const allGames: any[] = []
  for (const w of weeks) {
    try {
      const items = mode === 'core' ? await fetchCoreWeek(season, w) : await fetchSiteWeek(season, w)
      for (const it of items) {
        const hid = teamMap.get(normalizeKey(it.home))
        const aid = teamMap.get(normalizeKey(it.away))
        if (!hid || !aid) continue
        allGames.push({
          season, week: w, game_utc: it.kickoff,
          home_team: hid, away_team: aid,
          home_score: null, away_score: null, status: 'UPCOMING'
        })
      }
    } catch (e: any) {
      return json({ error: e.message }, 500)
    }
  }

  if (!allGames.length) return json({ ok: true, imported: 0 })

  const { data, error } = await adminSb
    .from('games')
    .upsert(allGames, { onConflict: 'season,week,home_team,away_team' })
    .select()

  if (error) return json({ error: error.message }, 500)

  return json({ ok: true, imported: data?.length ?? 0, games: data })
}
