'use client'

import { createBrowserSupabaseClient } from '@/lib/supabase-clients'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function InvitePage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const acceptInvite = async () => {
      if (!token) {
        setStatus('error')
        setMessage('Invalid invite link')
        return
      }

      const supabase = createBrowserSupabaseClient()

      const response = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (data.ok) {
        setStatus('success')
        setMessage('Successfully joined the league!')
      } else {
        setStatus('error')
        setMessage(data.error || 'Failed to accept invite')
      }
    }

    acceptInvite()
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        {status === 'loading' && <p>Processing invite...</p>}
        {status === 'success' && (
          <div>
            <p className="text-green-600">{message}</p>
            <a href="/" className="mt-4 inline-block underline">
              Go to Dashboard
            </a>
          </div>
        )}
        {status === 'error' && <p className="text-red-600">{message}</p>}
      </div>
    </div>
  )
}
