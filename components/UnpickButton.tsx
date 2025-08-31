'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  id?: string | null
  leagueId?: string
  season?: number
  week?: number
  teamId?: string
  disabled?: boolean
  className?: string
}

export default function UnpickButton({
  id,
  leagueId,
  season,
  week,
  teamId,
  disabled = false,
  className = "text-xs underline disabled:opacity-50",
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onUnpick() {
    if (loading || disabled) return
    setLoading(true)
    setErr(null)
    try {
      const qs = new URLSearchParams()
      if (id) qs.set('id', id)
      if (leagueId) qs.set('leagueId', leagueId)
      if (teamId) qs.set('teamId', teamId)
      if (typeof season === 'number') qs.set('season', String(season))
      if (typeof week === 'number') qs.set('week', String(week))

      const res = await fetch(`/api/picks?${qs.toString()}`, {
        method: 'DELETE',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      })
      if (!res.ok) {
        let msg = 'Failed to unpick'
        try { const j = await res.json(); msg = j?.error || msg } catch {}
        setErr(msg)
      } else {
        router.refresh()
      }
    } catch (e: any) {
      setErr(e?.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const label = disabled ? 'Locked' : (loading ? 'Unpicking…' : 'Unpick')

  return (
    <button
      type="button"
      onClick={onUnpick}
      disabled={disabled || loading}
      className={className}
      aria-busy={loading ? 'true' : 'false'}
      title={label}
    >
      {label}
      {err && <span className="sr-only"> — {err}</span>}
    </button>
  )
}
