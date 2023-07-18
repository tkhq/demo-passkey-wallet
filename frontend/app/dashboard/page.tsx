'use client'

import { AuthWidget } from '@/components/AuthWidget';
import { useAuth } from '@/components/context/auth.context';
import { getSubOrganizationUrl } from '@/utils/urls';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import useSWR from 'swr';

type subOrganization = {
  data: {},
}

async function subOrganizationFetcher(url: string): Promise<subOrganization> {
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
  const { data, error } = useSWR(getSubOrganizationUrl(), subOrganizationFetcher)

  useEffect(() => {
    if (state.isLoaded === true && state.isLoggedIn === false) {
      // Redirect the user to auth if not logged in
      router.push('/auth');
      return
    }
  }, [state, router])

  if (error) return <div>Failed to sub-organization</div>;
  if (!data) return <div>Loading...</div>;

  return (
    <div className="mb-32 grid lg:mb-0 lg:mt-8 lg:flex max-w-5xl">
      <AuthWidget></AuthWidget>
      <p className="text-md flex-none lg:w-1/3 p-8">
        <span className="text-xl">Welcome to your dashboard!</span>
        <br />
        <br />
        You are the owner of a completely independent Turnkey sub-organization.
        <br />
        <br />
        Here it is, in its entirety &rarr;
      </p>

      <div className="w-full flex-1">
        <pre className="w-full text-xs whitespace-pre-wrap break-words p-8">
          {JSON.stringify(data, null, 4)}
        </pre>
      </div>
    </div>
  )
}
