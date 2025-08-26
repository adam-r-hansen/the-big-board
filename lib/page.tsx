// app/page.tsx
import Link from 'next/link'

export default function Home() {
  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-bold">NFL Pick\'em</h1>
      <p>Welcome! Use the Admin page to import teams & schedule, then come back to make picks.</p>
      <Link className="underline" href="/admin">Go to Admin</Link>
    </main>
  )
}
