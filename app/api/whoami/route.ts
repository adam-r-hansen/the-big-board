import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-clients'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return NextResponse.json({ user })
}
