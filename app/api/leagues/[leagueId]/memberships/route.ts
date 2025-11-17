import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

function jsonNoStore(data: any, init: ResponseInit = {}) {
  const h = new Headers(init.headers)
  h.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  h.set('Pragma', 'no-cache')
  h.set('Expires', '0')
  h.set('Surrogate-Control', 'no-store')
  return new Response(JSON.stringify(data), { ...init, headers: h, status: init.status ?? 200 })
}

// GET - List all memberships (all users in the league) with profile info
export async function GET(req: NextRequest, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params
  
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  const user = auth?.user
  
  if (!user) {
    return jsonNoStore({ error: 'unauthenticated' }, { status: 401 })
  }

  // Check if user is admin/owner
  const { data: adminCheck } = await sb
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('profile_id', user.id)
    .maybeSingle()

  const isAdmin = adminCheck?.role === 'admin' || adminCheck?.role === 'owner'
  
  if (!isAdmin) {
    return jsonNoStore({ error: 'forbidden' }, { status: 403 })
  }

  // Get all memberships with profile info
  const { data: memberships, error } = await sb
    .from('league_memberships')
    .select('profile_id, profiles(email, display_name)')
    .eq('league_id', leagueId)
    .order('profiles(display_name)', { ascending: true })

  if (error) {
    return jsonNoStore({ error: error.message }, { status: 500 })
  }

  // Map to consistent format
  const users = (memberships || []).map((m: any) => ({
    profile_id: m.profile_id,
    email: m.profiles?.email || null,
    display_name: m.profiles?.display_name || m.profiles?.email || 'Unknown'
  }))

  return jsonNoStore({ users })
}
