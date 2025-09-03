'use client'

import { useState } from 'react'

type Props = {
  wrinkleId: string
  gameId: string
  teamId: string
  leagueId: string
  season: number
  week: number
  label: string
  picked?: boolean
  disabled?: boolean
  onSaved?: () => void
}

export default function WrinklePickButton({
  wrinkleId,
  gameId,
  teamId,
  leagueId,
  season,
  week,
  label,
  picked,
  disabled,
  onSaved,
}: Props) {
  const [busy, setBusy] = useState(false)

  async function save() {
    if (disabled || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/wrinkles/${wrinkleId}/picks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ teamId, gameId, leagueId, season, week }),
      })
      if (!res.ok) {
        let msg = 'Failed to save wrinkle pick'
        try {
          const j = await res.json()
          if (j?.error) msg = j.error
        } catch {}
        throw new Error(msg)
      }
      onSaved?.()
    } catch (e: any) {
      alert(e?.message || 'Failed to save wrinkle pick')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={save}
      disabled={disabled || busy}
      className={`h-10 w-full rounded-lg border px-3 text-sm font-semibold transition
        ${disabled || busy ? 'opacity-60 cursor-not-allowed' : 'hover:brightness-95'}
        ${picked ? 'bg-black text-white border-black' : 'bg-white text-black border-neutral-300 dark:bg-neutral-900 dark:text-white dark:border-neutral-700'}
      `}
      title={picked ? 'You picked this team' : 'Make wrinkle pick'}
    >
      {busy ? 'Saving…' : label}
    </button>
  )
}

