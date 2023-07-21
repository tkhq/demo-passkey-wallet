import './globals.css'
import type { Metadata } from 'next'
import Image from 'next/image'
import { Inter } from 'next/font/google'
import { AppProps } from 'next/app'
import { AuthProvider } from '@/components/context/auth.context'
import Head from 'next/head'
import { AuthWidget } from '@/components/AuthWidget'
import { usePathname } from 'next/navigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Demo Passkey Wallet',
  description: 'A demo Passkey-powered wallet, by Turnkey',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html className="bg-gray-100" lang="en">
      <Head>
        <title>Demo Passkey Wallet by Turnkey</title>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </Head>
      <body className={inter.className}>
        <main className="max-w-5xl min-h-screen p-8 m-auto">
          <AuthProvider>{children}</AuthProvider>
        </main>
        <footer className="m-8 text-center text-zinc-400 text-xs">
          <p>
            Copyright &copy; Turnkey Global Inc. All rights reserved.
            
            The code behind this demo is open-source and can be used under certain conditions. <a href="https://github.com/tkhq/demo-passkey-wallet/blob/main/LICENSE">See LICENSE file for more details</a>.
          </p>
        </footer>
      </body>
    </html>
  )
}