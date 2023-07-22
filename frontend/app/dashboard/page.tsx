'use client'

import { AuthWidget } from '@/components/AuthWidget';
import { Drop } from '@/components/Drop';
import { Nav } from '@/components/Nav';
import { useAuth } from '@/components/context/auth.context';
import { getSubOrganizationUrl, getWalletUrl } from '@/utils/urls';
import axios from 'axios';
import { Underdog } from 'next/font/google';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MouseEventHandler, useEffect } from 'react';
import useSWR from 'swr';

type resource = {
  data: any,
}

async function resourceFetcher(url: string): Promise<resource> {
  let response = await axios.get(url, {withCredentials: true})
  if (response.status === 200) {
      return {
          data: response.data,
      }
  } else {
      // Other status codes indicate an error of some sort
      return {
        data: {}
      }
  }
}


export default function Dashboard() {
  const { state } = useAuth();
  const router = useRouter();
  const { data: key, error: keyError, isValidating: isRefetchingKey } = useSWR(getWalletUrl(), resourceFetcher, { refreshInterval: 4000 })

  useEffect(() => {
    if (state.isLoaded === true && state.isLoggedIn === false) {
      // Redirect the user to auth if not logged in
      router.push('/auth');
      return
    }
  }, [state, router])

  if (keyError) {
    console.error("failed to load wallet information:", keyError)
  };

  return (
    <div>
      <Nav></Nav>
      <div className="grid grid-cols-5 gap-8 my-8 m-8 border-b pb-8">
        <div className="col-span-2">
          <h3 className="text-xl font-medium">Ethereum Network</h3>
          <p className="text-destructive-red text-sm mt-1">
            This address is for demo purposes only. Anything sent to this address may be lost permanently.
          </p>
        </div>

        <div className="col-auto col-span-3 bg-subtle-accent p-4 text-sm rounded-sm">
          <p className="mb-4">
            <span className="font-semibold mr-2">Address:</span>
            <span className="font-mono">{key && key.data["address"]}</span>
            <br/>
            {key ? <Link className="text-indigo-600 cursor-pointer" target="_blank" href={"https://sepolia.etherscan.io/address/" + key.data["address"]}>View on Etherscan &#128279;</Link> : null }
          </p>
          <p>
            <span className="font-semibold mr-2">Balance:</span>
            <span>{key ? key.data["balance"] : "_ . __"} Sepolia ETH</span>
            <br/>

            { key && key.data["dropsLeft"] !== undefined ? 
              <Drop dropsLeft={key.data["dropsLeft"] as number}></Drop>
              : null
            }

          </p>
        </div>
      </div>

      <div className="text-zinc-500 text-center font-semibold">
        <Link className="underline hover:font-bold" target="_blank" href={"https://turnkey.readme.io/reference/getting-started"} title="Ready to build?">
          Documentation
        </Link>
        {' '}|{' '}
        <Link className="underline hover:font-bold" target="_blank" href={getSubOrganizationUrl()} title="Did you know? You are the owner of a completely independent Turnkey Sub-Organization!">
          Sub-Org Details
        </Link>
      </div>
    </div>
  )
}
