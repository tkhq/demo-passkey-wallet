import './globals.css'
import type { Metadata } from 'next'
import Image from 'next/image'
import { Inter } from 'next/font/google'
import { AppProps } from 'next/app'
import { AuthProvider } from '@/components/context/auth.context'
import Head from 'next/head'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Piggybank',
  description: 'Piggybank, by Turnkey',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html className="bg-gray-100" lang="en">
      <Head>
        <title>Piggybank</title>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </Head>
      <body className={inter.className}>
        <main className="flex min-h-screen flex-col items-center justify-start p-12">
          <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
            <div className="fixed bottom-0 left-0 flex h-18 w-full items-end justify-center bg-gradient-to-t from-zinc-900 via-zinc-900 lg:static lg:h-auto lg:w-auto lg:bg-none">
              <a
                className="pointer-events-none flex place-items-center gap-2 lg:gap-0 lg:pointer-events-auto p-8 lg:p-0 text-white lg:text-inherit"
                href="/"
                rel="noopener noreferrer"
              >
                PIGGYBANK by{' '}
                <Image
                  src="/turnkey.svg"
                  alt="Turnkey Logo"
                  className="dark:invert"
                  width={32}
                  height={32}
                />
              </a>
            </div>
          </div>
          <AuthProvider>{children}</AuthProvider>
        </main>
      </body>
    </html>
  )
}