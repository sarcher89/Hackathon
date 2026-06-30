import type { Metadata } from 'next'
import { Orbitron } from 'next/font/google'
import './globals.css'

const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron' })

export const metadata: Metadata = {
  title: 'PS Time Tracker',
  description: 'Planet DDS Professional Services time tracking',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${orbitron.variable} min-h-screen bg-white text-slate-900 antialiased`}>
        {children}
      </body>
    </html>
  )
}
