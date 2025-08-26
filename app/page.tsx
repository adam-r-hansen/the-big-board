import Link from 'next/link'

export default function Home() {
  return (
    <main style={{display:'grid', gap:'1rem'}}>
      <h1 style={{fontSize:'1.75rem', fontWeight:700}}>NFL Pick&apos;em</h1>
      <p>Welcome! Use the Admin page to import teams & schedule, then come back to make picks.</p>
      <Link href="/admin" style={{textDecoration:'underline'}}>Go to Admin</Link>
    </main>
  )
}
