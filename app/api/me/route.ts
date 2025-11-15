import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-clients'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { user: null },
      { headers: { 'cache-control': 'no-store' } }
    )
  }

  return NextResponse.json(
    { user: { id: user.id, email: user.email } },
    { headers: { 'cache-control': 'no-store' } }
  )
}
