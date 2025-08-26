import type { Metadata } from 'next'
import UserHeader from '@/components/UserHeader'

export const metadata: Metadata = {
  title: 'Big Board Pick’em',
  description: 'NFL pick’em',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{margin:0}}>
        <UserHeader />
        {children}
      </body>
    </html>
  )
}
