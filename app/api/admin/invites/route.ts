// app/api/admin/invites/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function j(data: any, init?: number | ResponseInit) {
  const base: ResponseInit = typeof init === 'number' ? { status: init } : init || {}
  return NextResponse.json(data, { ...base, headers: { 'Cache-Control': 'no-store' } })
}

function srv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function assertAdmin() {
  const supabase = await createServerClient()
  const { data } = await supabase.auth.getUser()
  const email = data?.user?.email?.toLowerCase()
  const admin = (process.env.ADMIN_EMAIL || '').toLowerCase()
  if (!email || email !== admin) throw new Error('forbidden')
}

export async function GET() {
  try {
    await assertAdmin()
    const { data, error } = await srv().from('allowed_emails').select('email, created_at').order('created_at', { ascending: false })
    if (error) return j({ error: error.message }, 400)
    return j({ emails: data ?? [] }, 200)
  } catch (e: any) {
    return j({ error: e?.message || 'forbidden' }, e?.message === 'forbidden' ? 403 : 400)
  }
}

export async function POST(req: NextRequest) {
  try {
    await assertAdmin()
    const { email } = await req.json().catch(() => ({}))
    if (!email) return j({ error: 'email required' }, 400)
    const { error } = await srv().from('allowed_emails').upsert({ email: String(email).toLowerCase().trim() })
    if (error) return j({ error: error.message }, 400)
    return j({ ok: true }, 200)
  } catch (e: any) {
    return j({ error: e?.message || 'forbidden' }, e?.message === 'forbidden' ? 403 : 400)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await assertAdmin()
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')?.toLowerCase().trim()
    if (!email) return j({ error: 'email required' }, 400)
    const { error } = await srv().from('allowed_emails').delete().eq('email', email)
    if (error) return j({ error: error.message }, 400)
    return j({ ok: true }, 200)
  } catch (e: any) {
    return j({ error: e?.message || 'forbidden' }, e?.message === 'forbidden' ? 403 : 400)
  }
}
