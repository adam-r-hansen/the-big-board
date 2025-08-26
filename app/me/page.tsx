'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function MePage() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  return <main style={{padding:16}}>
    <h1>Me</h1>
    <p>{email ? `Signed in as ${email}` : 'Not signed in'}</p>
  </main>
}
