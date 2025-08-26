/**
 * Robust NFL schedule fetcher:
 * 1) Try ESPN CDN XHR (fast, what the site uses)
 * 2) Fallback to ESPN Core API (stable, but requires following refs)
 *
 * Docs/refs (community):
 *  - cdn.espn.com/core/nfl/schedule?xhr=1&year=YYYY&week=W
 *  - sports.core.api.espn.com/v2/.../seasons/{Y}/types/2/weeks/{W}/events
 */

async function getJson(url: string, revalidate = 300) {
  const res = await fetch(url, { next: { revalidate } })
  if (!res.ok) {
    const txt = await res.text().catch(()=>'')
    throw new Error(`ESPN fetch failed: ${res.status} ${res.statusText} :: ${url} :: ${txt.slice(0,120)}`)
  }
  return res.json()
}

function flattenEventsFromCdn(json: any): any[] {
  // CDN responses have shown multiple shapes. We'll defensively search for nodes
  // that look like an "event" (have id + competitions[0]) and flatten them.
  const out: any[] = []

  function walk(node: any) {
    if (!node || typeof node !== 'object') return
    if (node.id && Array.isArray(node.competitions)) {
      out.push(node)
    }
    for (const k of Object.keys(node)) {
      const v = (node as any)[k]
      if (v && typeof v === 'object') walk(v)
      if (Array.isArray(v)) v.forEach(walk)
    }
  }

  // Common spot: json.content.schedule.events or arrays-of-days under schedule
  walk(json?.content ?? json)
  return out
}

async function fetchWeekFromCdn(year: number, week: number) {
  const url = new URL('https://cdn.espn.com/core/nfl/schedule')
  url.searchParams.set('xhr', '1')
  url.searchParams.set('year', String(year))
  url.searchParams.set('week', String(week))
  const json = await getJson(url.toString(), 180)
  const events = flattenEventsFromCdn(json)
  return events
}

async function fetchJsonByRef(ref: string) {
  const j = await getJson(ref, 300)
  return j
}

async function fetchWeekFromCore(year: number, week: number) {
  // 1) list events
  const listUrl = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${year}/types/2/weeks/${week}/events?limit=1000`
  const list = await getJson(listUrl, 300)
  const items: { $ref: string }[] = list?.items || []
  const events: any[] = []

  // 2) For each event, hydrate minimal details we need (date, teams, scores, status)
  //    We can get competitions[0] directly at: events/{id}/competitions/{id}
  for (const it of items) {
    if (!it?.$ref) continue
    const ev = await fetchJsonByRef(it.$ref)  // event summary
    // competition ref
    const compRef = ev?.competitions?.[0]?.$ref
    if (!compRef) continue
    const comp = await fetchJsonByRef(compRef)

    // competitors array has .homeAway, .team.$ref -> hydrate team id quickly
    for (const c of comp.competitors || []) {
      if (c?.team?.$ref && !c.team.id) {
        const team = await fetchJsonByRef(c.team.$ref)
        c.team.id = team?.id
      }
    }

    // Normalize to match CDN event shape minimally
    events.push({
      id: ev?.id ?? comp?.id,
      competitions: [comp],
    })
  }

  return events
}

export async function fetchWeekSchedule(year: number, week: number) {
  try {
    const cdnEvents = await fetchWeekFromCdn(year, week)
    if (cdnEvents.length > 0) return cdnEvents
  } catch (e) {
    // swallow and try core
  }
  // fallback
  return await fetchWeekFromCore(year, week)
}

export async function fetchTeams() {
  const res = await fetch(process.env.ESPN_TEAMS_URL!, { next: { revalidate: 86400 } })
  if (!res.ok) {
    const txt = await res.text().catch(()=>'')
    throw new Error(`ESPN teams failed: ${res.status} ${res.statusText} :: ${txt.slice(0,120)}`)
  }
  return res.json()
}
