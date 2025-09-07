// app/admin/layout.tsx
import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

function parseOwners(envVal: string | undefined) {
  return (envVal ?? '')
    .split(/[,\s]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user ?? null

  const owners = parseOwners(process.env.SITE_OWNER_EMAILS)
  const isOwner = !!(user?.email && owners.includes(user.email.toLowerCase()))

  if (!isOwner) redirect('/')

  return <>{children}</>
}
