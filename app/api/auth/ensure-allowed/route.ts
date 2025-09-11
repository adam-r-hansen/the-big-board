// app/api/auth/ensure-allowed/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const email = data?.user?.email?.toLowerCase()
  if (!email) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })

  const { data: row, error } = await supabase.from('allowed_emails').select('email').eq('email', email).maybeSingle()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

  if (!row) {
    await supabase.auth.signOut()
    return NextResponse.json({ ok: false, error: 'not_allowed' }, { status: 403 })
  }
  return NextResponse.json({ ok: true }, { status: 200 })
}
