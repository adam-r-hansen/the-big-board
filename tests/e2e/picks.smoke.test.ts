import { expect, test } from 'vitest'

const base = process.env.E2E_BASE_URL || 'http://localhost:3000'

async function j(res: Response) { try { return await res.json() } catch { return null } }

test('user can create and then delete a pick', async () => {
  // Assume you’re logged in locally via the browser (or use service role locally if you have one).
  const leagueId = process.env.E2E_LEAGUE_ID!
  const season = 2025
  const week = 1
  const teamId = process.env.E2E_TEAM_ID!
  const gameId = process.env.E2E_GAME_ID!

  const p = await fetch(`${base}/api/picks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ leagueId, season, week, teamId, gameId })
  })
  const pj = await j(p)
  expect(p.status).toBe(200)
  expect(pj?.ok).toBe(true)
  const pickId = pj?.id as string

  const d = await fetch(`${base}/api/picks?id=${pickId}`, { method: 'DELETE' })
  const dj = await j(d)
  expect(d.status).toBe(200)
  expect(dj?.ok).toBe(true)
})
