import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function noStoreJson(data: any, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set('Cache-Control', 'no-store')
  return NextResponse.json(data, { ...init, headers })
}

// Helper to create admin client with service role
function createAdminClient() {
  const { createClient: createSupabaseClient } = require('@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing Supabase credentials for admin client')
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Check if user is authorized (site owner or league owner)
async function checkAuth() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user

  if (!user) {
    throw new Error('unauthenticated')
  }

  const email = user.email?.toLowerCase()
  const siteOwners = (process.env.SITE_OWNER_EMAILS || '').split(',').map(e => e.trim().toLowerCase())
  const isSiteOwner = email && siteOwners.includes(email)

  if (isSiteOwner) {
    return { authorized: true, user }
  }

  // Check if user is a league owner
  const { data: membership } = await supabase
    .from('league_members')
    .select('role')
    .eq('profile_id', user.id)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle()

  if (membership) {
    return { authorized: true, user }
  }

  throw new Error('forbidden')
}

/**
 * GET /api/admin/teams
 * Returns all teams with their color settings
 */
export async function GET() {
  try {
    await checkAuth()

    const admin = createAdminClient()
    const { data: teams, error } = await admin
      .from('teams')
      .select(
        'id, name, short_name, abbreviation, logo, color_primary, color_secondary, color_tertiary, color_quaternary, color_pref_light, color_pref_dark, ui_light_color_key, ui_dark_color_key'
      )
      .order('name')

    if (error) {
      return noStoreJson({ error: error.message }, { status: 500 })
    }

    return noStoreJson({ teams: teams || [] })
  } catch (e: any) {
    const msg = e?.message || 'error'
    const status = msg === 'unauthenticated' ? 401 : msg === 'forbidden' ? 403 : 500
    return noStoreJson({ error: msg }, { status })
  }
}

/**
 * PATCH /api/admin/teams
 * Updates color preferences for a specific team
 * Body: { teamId: string, color_pref_light: string, color_pref_dark: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    await checkAuth()

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      return noStoreJson({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { teamId, color_pref_light, color_pref_dark } = body

    if (!teamId) {
      return noStoreJson({ error: 'teamId is required' }, { status: 400 })
    }

    if (!color_pref_light || !color_pref_dark) {
      return noStoreJson(
        { error: 'color_pref_light and color_pref_dark are required' },
        { status: 400 }
      )
    }

    // Validate hex color format
    const hexPattern = /^#[0-9A-Fa-f]{6}$/
    if (!hexPattern.test(color_pref_light) || !hexPattern.test(color_pref_dark)) {
      return noStoreJson({ error: 'Colors must be valid hex codes (e.g., #002a5c)' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('teams')
      .update({
        color_pref_light,
        color_pref_dark,
      })
      .eq('id', teamId)
      .select()
      .single()

    if (error) {
      return noStoreJson({ error: error.message }, { status: 500 })
    }

    return noStoreJson({ ok: true, team: data })
  } catch (e: any) {
    const msg = e?.message || 'error'
    const status = msg === 'unauthenticated' ? 401 : msg === 'forbidden' ? 403 : 500
    return noStoreJson({ error: msg }, { status })
  }
}
