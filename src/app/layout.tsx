import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Intelligence Dashboard',
  description: 'Client Performance & Competitive Intelligence Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
