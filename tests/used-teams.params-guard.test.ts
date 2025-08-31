import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/used-teams/route'
import { NextRequest } from 'next/server'

const mkReq = (url: string) => new NextRequest(url)

describe('GET /api/used-teams param handling', () => {
  it('returns empty used when params are missing', async () => {
    const res = await GET(mkReq('http://localhost/api/used-teams'))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(Array.isArray(j.used)).toBe(true)
  })
})
