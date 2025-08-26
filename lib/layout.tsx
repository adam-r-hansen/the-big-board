// app/layout.tsx
import './globals.css'
export const metadata = { title: 'The Big Board', description: 'NFL Pick\'em' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="mx-auto max-w-4xl p-4 text-gray-900 dark:text-gray-100">{children}</body>
    </html>
  )
}
