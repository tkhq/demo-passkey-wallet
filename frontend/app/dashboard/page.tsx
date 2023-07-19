'use client'

import { AuthWidget } from '@/components/AuthWidget';
import { useAuth } from '@/components/context/auth.context';
import { getKeyUrl, getSubOrganizationUrl, getWalletUrl } from '@/utils/urls';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
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
  const { data: subOrganization, error: subOrganizationError } = useSWR(getSubOrganizationUrl(), resourceFetcher)
  const { data: key, error: keyError } = useSWR(getWalletUrl(), resourceFetcher)

  useEffect(() => {
    if (state.isLoaded === true && state.isLoggedIn === false) {
      // Redirect the user to auth if not logged in
      router.push('/auth');
      return
    }
  }, [state, router])

  if (subOrganizationError || keyError) return <div>Failed to load the dashboard</div>;
  if (!subOrganization || !key) return <div>Loading...</div>;

  return (
    <div>
      <AuthWidget></AuthWidget>
      <h2 className="text-xl border text-center rounded-md flex-none m-8 p-4 bg-zinc-900 text-white tracking-wider uppercase">Dashboard</h2>
      <div className="mb-32 grid lg:mb-0 lg:mt-8 lg:flex max-w-5xl">

        <div className="w-full text-center">
          <p>Your ETH Address</p>
          <pre className="font-bold">{key.data["address"]}</pre>
        </div>
      </div>

      <div className="mb-32 grid lg:mb-0 lg:mt-8 lg:flex max-w-5xl">
        <p className="text-md flex-none lg:w-1/3 p-8">
          Did you know? You are the owner of a completely independent Turnkey sub-organization.
          <br />
          <br />
          Here it is, in its entirety &rarr;
        </p>

        <div className="w-full flex-1">
          <pre className="w-full text-xs whitespace-pre-wrap break-all p-8">
            {JSON.stringify(subOrganization, null, 4)}
          </pre>
        </div>
      </div>
    </div>
  )
}
