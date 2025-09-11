// app/api/me/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    const user = data?.user || null
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase()
    const isAdmin = !!user?.email && user.email.toLowerCase() === adminEmail
    return NextResponse.json(
      { ok: true, user: user ? { id: user.id, email: user.email } : null, isAdmin },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  }
}
