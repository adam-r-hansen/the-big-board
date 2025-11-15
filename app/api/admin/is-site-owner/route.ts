import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-clients'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { isSiteOwner: false },
      { headers: { 'cache-control': 'no-store' } }
    )
  }

  const siteOwnerEmails = (process.env.SITE_OWNER_EMAILS || '').split(',').map(e => e.trim())
  const isSiteOwner = siteOwnerEmails.includes(user.email || '')

  return NextResponse.json(
    { isSiteOwner },
    { headers: { 'cache-control': 'no-store' } }
  )
}
