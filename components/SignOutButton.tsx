'use client'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function SignOutButton() {
  const router = useRouter()
  async function onClick() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
    await supabase.auth.signOut() // default scope = global
    router.push('/login')
  }
  return (
    <button onClick={onClick} className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm">
      Sign out
    </button>
  )
}
