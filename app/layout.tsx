import type { Metadata } from 'next'
import SiteHeader from '@/components/SiteHeader'
import './globals.css'

export const metadata: Metadata = {
  title: 'Big Board Pick’em',
  description: 'NFL pick’em',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  )
}

