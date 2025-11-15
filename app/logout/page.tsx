'use client'

import { createBrowserSupabaseClient } from '@/lib/supabase-clients'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    const signOut = async () => {
      const supabase = createBrowserSupabaseClient()
      await supabase.auth.signOut()
      router.push('/')
    }
    signOut()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>Signing out...</p>
    </div>
  )
}
