'use client'

import { useTheme } from 'next-themes'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  if (!resolvedTheme) return null
  const next = resolvedTheme === 'light' ? 'dark' : 'light'
  return (
    <button
      onClick={() => setTheme(next)}
      className="px-3 py-2 rounded-md border text-sm"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {resolvedTheme === 'light' ? '🌙 Dark' : '☀️ Light'}
    </button>
  )
}
