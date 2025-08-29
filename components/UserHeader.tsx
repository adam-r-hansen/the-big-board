'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function UserHeader() {
  const [email, setEmail] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setEmail(session?.user?.email ?? null)
    })
    return () => { sub?.subscription?.unsubscribe?.() }
  }, [supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    setEmail(null)
    router.replace('/login')
  }

  return (
    <header style={{
      padding: '12px 16px',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      background: '#fff',
      zIndex: 10,
      boxShadow: '0 1px 0 rgba(0,0,0,0.05)'
    }}>
      <Link href="/" style={{fontWeight: 800, textDecoration:'none', color:'#111'}}>Big Board Pick’em</Link>
      {email ? (
        <div style={{display:'flex', gap:10, alignItems:'center'}}>
          <span style={{opacity:.8}}>Signed in: {email}</span>
          <button onClick={signOut} style={{border:'1px solid #ccc', padding:'6px 10px', cursor:'pointer'}}>Sign out</button>
        </div>
      ) : (
        <Link href="/login">
          <button style={{border:'1px solid #ccc', padding:'6px 10px', cursor:'pointer'}}>Sign in</button>
        </Link>
      )}
    </header>
  )
}

// Add theme toggle
import { ThemeToggle } from './ThemeToggle'

{/* Place this where you want the toggle */}
{/* <ThemeToggle /> */}
