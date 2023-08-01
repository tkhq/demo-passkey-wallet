
'use client'
import Link from 'next/link';


export function Footer() {
    return (
        <footer className="m-8 grid-cols-3 text-center text-zinc-400 text-xs">
          <p>
            © 2023 Turnkey Global, Inc. All rights reserved.
            {' '}
            <Link className="underline" target="_blank" href="https://github.com/tkhq/demo-passkey-wallet#legal-disclaimer">Legal disclaimer</Link>.
          </p>
        </footer>
    )
}