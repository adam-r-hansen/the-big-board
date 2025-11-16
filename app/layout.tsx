import type { Metadata } from 'next'
import NavBar from '@/components/NavBar'
import './globals.css'

export const metadata: Metadata = {
  title: 'Big Board Pickem',
  description: 'NFL pickem',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
        <NavBar />
        {children}
      </body>
    </html>
  )
}
