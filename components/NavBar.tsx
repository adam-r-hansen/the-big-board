// components/NavBar.tsx
import { createClient } from '@/utils/supabase/server'
import UnifiedNav from './UnifiedNav'

function emailIsSiteOwner(email?: string | null): boolean {
  if (!email) return false
  const raw = process.env.SITE_OWNER_EMAILS || ''
  const set = new Set(
    raw
      .toLowerCase()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
  return set.has(email.toLowerCase())
}

async function checkIsAdmin(userId: string, userEmail?: string | null): Promise<boolean> {
  // First check if they're a site owner via env var
  if (emailIsSiteOwner(userEmail)) return true

  // Then check if they're an owner of any league
  const sb = await createClient()
  const { data, error } = await sb
    .from('league_members')
    .select('role')
    .eq('profile_id', userId)
    .eq('role', 'owner')
    .limit(1)

  if (error) return false
  return (data?.length ?? 0) > 0
}

export default async function NavBar() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user ?? null

  let isAdmin = false
  if (user) {
    isAdmin = await checkIsAdmin(user.id, user.email)
  }

  return <UnifiedNav userEmail={user?.email} isAdmin={isAdmin} />
}
