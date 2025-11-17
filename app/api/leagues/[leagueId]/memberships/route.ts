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

  // Get all memberships
  const { data: memberships, error: membershipError } = await sb
    .from('league_memberships')
    .select('profile_id')
    .eq('league_id', leagueId)

  if (membershipError) {
    return jsonNoStore({ error: membershipError.message }, { status: 500 })
  }

  if (!memberships || memberships.length === 0) {
    return jsonNoStore({ users: [] })
  }

  // Get profile info for all members
  const profileIds = memberships.map(m => m.profile_id)
  const { data: profiles, error: profileError } = await sb
    .from('profiles')
    .select('id, email, display_name')
    .in('id', profileIds)

  if (profileError) {
    return jsonNoStore({ error: profileError.message }, { status: 500 })
  }

  // Map to consistent format
  const users = (profiles || []).map((p: any) => ({
    profile_id: p.id,
    email: p.email || null,
    display_name: p.display_name || p.email || 'Unknown'
  }))

  // Sort by display name
  users.sort((a, b) => a.display_name.localeCompare(b.display_name))

  return jsonNoStore({ users })
}
