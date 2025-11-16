// app/api/leagues/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function j(data: any, init?: number | ResponseInit) {
  const base: ResponseInit = typeof init === 'number' ? { status: init } : init || {}
  const headers = new Headers(base.headers)
  headers.set('Cache-Control', 'no-store')
  return NextResponse.json(data, { ...base, headers })
}

async function getClient() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  return { supabase, user: data?.user ?? null, error }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, error } = await getClient()
  if (error || !user) return j({ error: 'unauthenticated' }, 401)

  const { id } = await context.params

  const { data: league, error: leagueError } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', id)
    .single()

  if (leagueError) {
    return j({ error: leagueError.message }, 400)
  }

  return j({ league })
}
