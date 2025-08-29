'use client'

import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'

export function NextThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"      // adds/removes 'dark' class on <html>
      defaultTheme="system"  // follow OS by default
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  )
}
