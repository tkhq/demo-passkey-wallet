import { AuthWidget } from '@/components/AuthWidget'
import Image from 'next/image'

export default async function Home() {
  return (
    <div>
      <div className="align-center">
        <Image
          className="mx-auto align-center"
          src="/turntkey.gif"
          alt="Demo Passkey Wallet Logo"
          width={400}
          height={400}
          priority
        />
      </div>

      <AuthWidget></AuthWidget>

      <div className="mb-32 grid text-center lg:mb-0 lg:mt-8 lg:grid-cols-3 lg:text-left">
        <a
          href="https://turnkey.io"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Self-Custodial{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[40ch] text-sm opacity-50`}>
            We cannot access your keys, cannot access your coins. Turnkey magic.
          </p>
        </a>

        <a
          href="https://turnkey.readme.io/reference/getting-started"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            API-driven{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[40ch] text-sm opacity-50`}>
            Piggy bank creates an isolated Sub-Organization where you are the root user. Private keys are yours. Check out the API reference for more details.
          </p>
        </a>

        <a
          href="https://github.com/tkhq/demo-passkey-wallet"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
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
