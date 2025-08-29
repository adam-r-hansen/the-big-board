import type { Metadata } from 'next'
import { NextThemeProvider } from './theme-provider'
import AppHeader from '@/components/AppHeader'
import './globals.css'

export const metadata: Metadata = { title: "Big Board Pick'em" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
        <NextThemeProvider>
          <AppHeader />
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </NextThemeProvider>
      </body>
    </html>
  )
}
