'use client'

import { createBrowserSupabaseClient } from '@/lib/supabase-clients'
import { useEffect, useState } from 'react'

export default function MePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createBrowserSupabaseClient()
      const { data } = await supabase.auth.getUser()
      setUser(data.user)
      setLoading(false)
    }
    fetchUser()
  }, [])

  if (loading) return <div>Loading...</div>

  if (!user) return <div>Not logged in</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">My Profile</h1>
      <div className="space-y-2">
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>ID:</strong> {user.id}</p>
      </div>
    </div>
  )
}
