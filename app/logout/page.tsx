'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function LogoutPage() {
  const r = useRouter()
  useEffect(() => {
    const run = async () => {
      const sb = createClient()
      await sb.auth.signOut()
      r.replace('/login')
    }
    run()
  }, [r])
  return <main style={{padding:24}}>Signing you out…</main>
}
