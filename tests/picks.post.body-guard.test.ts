import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/picks/route'
import { NextRequest } from 'next/server'

const mkReq = (body: any) =>
  new NextRequest('http://localhost/api/picks', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  })

describe('POST /api/picks body validation', () => {
  it('rejects missing fields with 400', async () => {
    const res = await POST(mkReq({}))
    expect(res.status).toBe(400)
  })
})
