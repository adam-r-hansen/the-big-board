export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: { 'content-type':'application/json' },
  })
}

export async function GET() {
  const keyA = process.env.SUPABASE_SERVICE_ROLE_KEY
  const keyB = process.env.SUPABASE_SERVICE_ROLE
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL

  // never leak secrets; only lengths + masked snippet
  const mask = (s?: string) => s ? `len=${s.length} • ${s.slice(0,4)}...` : null

  return json({
    runtime: 'nodejs',
    vercelRegion: process.env.VERCEL_REGION || null,
    NEXT_PUBLIC_SUPABASE_URL: !!url,
    SUPABASE_SERVICE_ROLE_KEY_present: !!keyA,
    SUPABASE_SERVICE_ROLE_present: !!keyB,
    _debug: {
      SUPABASE_SERVICE_ROLE_KEY: mask(keyA || undefined),
      SUPABASE_SERVICE_ROLE: mask(keyB || undefined),
    }
  })
}
