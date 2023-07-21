import { AuthWidget } from '@/components/AuthWidget'
import { Nav } from '@/components/Nav'
import Image from 'next/image'

export default async function Home() {
  return (
    <div>
      <Nav></Nav>
      <div className="align-center bg-black rounded-lg p-12 mt-8">
        <Image
          className="mx-auto align-center"
          src="/turnkey_logo_white.svg"
          alt="Demo Passkey Wallet Logo"
          width={80}
          height={140}
          priority
        />
      </div>

      <div className="mb-32 grid text-center lg:mb-0 lg:mt-8 lg:grid-cols-3 lg:text-left">
        <a
          href="https://turnkey.readme.io/reference/getting-started"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-zinc-200"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Non-Custodial{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[40ch] text-sm opacity-50`}>
            Only you can access your keys. Checkout our API-reference for more details.
          </p>
        </a>

        <a
          href="https://turnkey.io"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-zinc-200"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Passwordless{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[40ch] text-sm opacity-50`}>
            We use Passkeys to offer the best user experience and security in one. Learn more.
          </p>
        </a>

        <a
          href="https://github.com/tkhq/demo-passkey-wallet"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-zinc-200"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Open-source{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[40ch] text-sm opacity-50`}>
            Curious about how this is built? Check out the code for yourself!
          </p>
        </a>
      </div>
    </div>
  )
}
